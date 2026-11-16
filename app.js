const login = document.querySelector('#login');
const handbook = document.querySelector('#handbook');
const pages = document.querySelector('#pages');
const status = document.querySelector('#status');
const storageKey = 'jeju-handbook-session';
let token = localStorage.getItem(storageKey);
let pending = false;
function showPage() {
  const sections = [...pages.querySelectorAll('section')];
  const selected = sections.find(x => '#' + x.id === location.hash) || sections[0];
  sections.forEach(x => x.hidden = x !== selected);
  pages.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#' + selected?.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
function render(data) {
  login.hidden = true;
  handbook.hidden = false;
  document.querySelector('#visitor').textContent = data.name;
  pages.innerHTML = data.html;
  pages.querySelectorAll('#shopping > h2').forEach(heading => heading.remove());
  const packing = pages.querySelector('#before h2:nth-of-type(2)');
  if (packing) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '出门前核对行李';
    details.append(summary);
    while (packing.nextSibling) details.append(packing.nextSibling);
    packing.replaceWith(details);
  }
  for (const [key, personal] of [['shared', false], ['personal', true]]) {
    const list = document.getElementById(key);
    const form = document.createElement('form');
    form.innerHTML = '<input required maxlength="120" aria-label="新项目" placeholder="添加一项"> <button>添加</button>';
    form.onsubmit = event => {
      event.preventDefault();
      request('add', {personal, item_title: form.querySelector('input').value});
    };
    if (!personal) list.append(form);
    for (const item of data.items.filter(item => Boolean(item.owner) === personal)) {
      const row = document.createElement('article');
      const title = document.createElement('button');
      title.className = 'toggle';
      title.textContent = (item.done ? '✓  ' : '□  ') + item.title;
      const author = document.createElement('small');
      author.textContent = item.author + (item.deleted_at ? ' · 已删除' : '');
      row.append(title, author);
      title.disabled = Boolean(item.deleted_at);
      title.setAttribute('aria-pressed', String(item.done));
      title.onclick = () => request('toggle', {item_id: item.id, completed: !item.done});
      function button(label, action, values = {}) {
        const control = document.createElement('button');
        control.textContent = label;
        control.onclick = () => request(action, {item_id: item.id, ...values});
        author.append(control);
      }
      if (item.deleted_at) button('撤销', 'undo');
      else {
        const edit = document.createElement('button');
        edit.textContent = '修改';
        edit.onclick = () => {
          const value = prompt('修改项目', item.title);
          if (value?.trim()) request('edit', {item_id: item.id, item_title: value});
        };
        author.append(edit);
        button('删除', 'delete');
      }
      if (personal && !item.deleted_at) {
        const groups = ['自己用', '给妈妈', '送朋友', '伴手礼', '其他'];
        const groupIndex = /防晒|视黄醇|壬二酸/.test(item.title) ? 0 :
          /水乳|精华|面膜/.test(item.title) ? 1 :
          /礼盒|耳饰|明信片/.test(item.title) ? 2 :
          /巧克力|花生|米花糖/.test(item.title) ? 3 : 4;
        let group = list.querySelector('[data-group="' + groupIndex + '"]');
        if (!group) {
          group = document.createElement('div');
          group.dataset.group = groupIndex;
          const heading = document.createElement('h2');
          heading.textContent = groups[groupIndex];
          group.append(heading);
          list.append(group);
        }
        group.append(row);
      } else list.append(row);
    }
    if (personal) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = '＋ 添加购物项目';
      details.append(summary, form);
      list.append(details);
    }
  }
  showPage();
}
function clearSession() {
  localStorage.removeItem(storageKey);
  token = null;
  handbook.hidden = true;
  pages.replaceChildren();
  login.hidden = false;
}
async function request(action, args = {}) {
  if (pending) return;
  pending = true;
  status.textContent = '加载中…';
  try {
    const response = await fetch(config.url + '/rest/v1/rpc/jeju_handbook_request', {
      method: 'POST',
      headers: {apikey: config.key, 'Content-Type': 'application/json'},
      body: JSON.stringify({action, session_token: token, ...args})
    });
    if (response.status === 401) clearSession();
    const data = await response.json();
    if (!response.ok) throw Error(response.status === 404 ? '旅行手册后端尚未配置' : data.message || '操作失败');
    if (action === 'login') {
      token = data.token;
      localStorage.setItem(storageKey, token);
      login.reset();
    } else if (action === 'logout') clearSession();
    else render(data);
    status.textContent = '';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    pending = false;
  }
  if (action === 'login' && token) request('read');
}
login.onsubmit = event => {
  event.preventDefault();
  request('login', Object.fromEntries(new FormData(login)));
};
document.querySelector('#logout').onclick = () => request('logout');
addEventListener('hashchange', showPage);
if (token) request('read');
