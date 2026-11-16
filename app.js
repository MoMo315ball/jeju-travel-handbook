const login = document.querySelector('#login');
const handbook = document.querySelector('#handbook');
const pages = document.querySelector('#pages');
const status = document.querySelector('#status');
const storageKey = 'jeju-handbook-session';
let token = null;
try { token = localStorage.getItem(storageKey); } catch {}
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
function displayName(name) {
  return name === '球球' ? '姐姐' : name;
}
function render(data) {
  login.hidden = true;
  handbook.hidden = false;
  document.querySelector('#visitor').textContent = displayName(data.name);
  pages.innerHTML = data.html;
  for (const sectionId of ['east', 'west', 'city']) {
    const section = pages.querySelector('#' + sectionId);
    const heading = section.querySelector('h1');
    heading.textContent = heading.textContent.split(' · ')[0];
    const placeholder = document.createElement('p');
    placeholder.textContent = '待定';
    section.replaceChildren(heading, placeholder);
  }
  for (const heading of pages.querySelectorAll('#arrival h2, #return h2')) {
    heading.textContent = heading.textContent.replace('（球球）', '（姐姐）');
  }
  const sortedItems = data.items.filter(item => !item.deleted_at).sort((first, second) =>
    Number(first.done) - Number(second.done) ||
    Date.parse(second.created_at) - Date.parse(first.created_at)
  );
  pages.querySelectorAll('#shopping > h2').forEach(heading => heading.remove());
  pages.querySelector('nav a[href="#shopping"]').textContent = '购物清单';
  const packing = pages.querySelector('#before h2:nth-of-type(2)');
  while (packing.nextSibling) packing.nextSibling.remove();
  packing.textContent = '个人待办';
  const privateTasks = document.createElement('div');
  privateTasks.id = 'private-tasks';
  packing.after(privateTasks);
  // Personal todos reuse the existing account-scoped item endpoint.
  const prefix = '[个人待办] ';
  for (const key of ['shared', 'private-tasks', 'personal']) {
    const personal = key !== 'shared';
    const isTodo = key === 'private-tasks';
    const isShopping = key === 'personal';
    const list = document.getElementById(key);
    const form = document.createElement('form');
    form.innerHTML = '<input required maxlength="120" aria-label="新项目" placeholder="添加一项"> <button>添加</button>';
    const input = form.querySelector('input');
    const hint = isTodo ? '添加个人待办，仅自己可见' :
      isShopping ? '添加一项' : '添加共享待办，所有人可见';
    input.placeholder = hint;
    input.setAttribute('aria-label', hint);
    if (isTodo) input.maxLength -= prefix.length;
    form.onsubmit = event => {
      event.preventDefault();
      const value = input.value.trim();
      if (value) request('add', {personal, item_title: (isTodo ? prefix : '') + value});
    };
    if (!isShopping) list.append(form);
    for (const item of sortedItems.filter(item => Boolean(item.owner) === personal &&
      (!personal || item.title.startsWith(prefix) === isTodo))) {
      const itemTitle = isTodo ? item.title.slice(prefix.length) : item.title;
      const row = document.createElement('article');
      const title = document.createElement('button');
      title.className = 'toggle';
      title.textContent = (item.done ? '✓  ' : '□  ') + itemTitle;
      const author = document.createElement('small');
      author.textContent = displayName(item.author);
      row.append(title, author);
      title.setAttribute('aria-pressed', String(item.done));
      title.onclick = () => request('toggle', {item_id: item.id, completed: !item.done});
      function button(label, action, values = {}) {
        const control = document.createElement('button');
        control.textContent = label;
        control.onclick = () => request(action, {item_id: item.id, ...values});
        author.append(control);
      }
      const edit = document.createElement('button');
      edit.textContent = '修改';
      edit.onclick = () => {
        const value = prompt('修改项目', itemTitle);
        if (value?.trim()) request('edit', {item_id: item.id, item_title: (isTodo ? prefix : '') + value.trim()});
      };
      author.append(edit);
      button('删除', 'delete');
      if (isShopping) {
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
    if (isShopping) {
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
  try { localStorage.removeItem(storageKey); } catch {}
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
      try { localStorage.setItem(storageKey, token); } catch {}
      login.reset();
    } else if (action === 'logout') clearSession();
    else render(data);
    status.textContent = '';
  } catch (error) {
    status.textContent = error instanceof TypeError
      ? '连接登录服务失败。请切换 Wi-Fi 或移动网络后重试，也可以用右上角菜单在浏览器打开。'
      : error.message;
  } finally {
    pending = false;
  }
  if (action === 'login' && token) request('read');
}
login.onsubmit = event => {
  event.preventDefault();
  const {member_name, invite_code} = Object.fromEntries(new FormData(login));
  request('login', {member_name, invite_code: invite_code.trim()});
};
document.querySelector('#logout').onclick = () => request('logout');
addEventListener('hashchange', showPage);
if (token) request('read');
