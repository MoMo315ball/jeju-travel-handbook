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
}
function render(data) {
  login.hidden = true;
  handbook.hidden = false;
  document.querySelector('#visitor').textContent = data.name;
  pages.innerHTML = data.html;
  for (const [key, personal] of [['shared', false], ['personal', true]]) {
    const list = document.getElementById(key);
    const form = document.createElement('form');
    form.innerHTML = '<input required maxlength="120" aria-label="新项目" placeholder="添加一项"> <button>添加</button>';
    form.onsubmit = event => {
      event.preventDefault();
      request('add', {personal, item_title: form.querySelector('input').value});
    };
    list.append(form);
    for (const item of data.items.filter(item => Boolean(item.owner) === personal)) {
      const row = document.createElement('article');
      const title = document.createElement('strong');
      title.textContent = (item.done ? '✓ ' : '') + item.title;
      const author = document.createElement('small');
      author.textContent = item.author + (item.deleted_at ? ' · 已删除' : '');
      row.append(title, author);
      function button(label, action, values = {}) {
        const control = document.createElement('button');
        control.textContent = label;
        control.onclick = () => request(action, {item_id: item.id, ...values});
        row.append(control);
      }
      if (item.deleted_at) button('撤销', 'undo');
      else {
        button(item.done ? '取消完成' : '完成', 'toggle', {completed: !item.done});
        const edit = document.createElement('button');
        edit.textContent = '修改';
        edit.onclick = () => {
          const value = prompt('修改项目', item.title);
          if (value?.trim()) request('edit', {item_id: item.id, item_title: value});
        };
        row.append(edit);
        button('删除', 'delete');
      }
      list.append(row);
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
