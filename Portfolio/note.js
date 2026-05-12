(function(){
  const storageKey = 'notes.v1';
  const searchEl = document.getElementById('search');
  const titleInput = document.getElementById('title-input');
  const bodyInput = document.getElementById('body-input');
  const addBtn = document.getElementById('add-note-btn');
  const clearBtn = document.getElementById('clear-editor-btn');
  const newNoteBtn = document.getElementById('new-note-btn');
  const pinnedList = document.getElementById('pinned-list');
  const notesList = document.getElementById('notes-list');
  const editModal = document.getElementById('edit-modal');
  const editTitle = document.getElementById('edit-title-input');
  const editBody = document.getElementById('edit-body-input');
  const saveEditBtn = document.getElementById('save-edit-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  let notes = [];
  let filter = '';
  let editingId = null;

  function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
  function now(){return new Date().toISOString()}
  function load(){try{const raw=localStorage.getItem(storageKey);notes=raw?JSON.parse(raw):[]}catch{notes=[]}}
  function save(){localStorage.setItem(storageKey,JSON.stringify(notes))}

  function resetEditor(){titleInput.value='';bodyInput.value=''}

  function openEdit(id){const n=notes.find(x=>x.id===id);if(!n)return;editingId=id;editTitle.value=n.title;editBody.value=n.body;editModal.classList.remove('hidden')}
  function closeEdit(){editingId=null;editModal.classList.add('hidden')}

  function createCard(n){
    const el=document.createElement('div');
    el.className='note-card';
    const top=document.createElement('div');
    top.className='card-top';
    const left=document.createElement('div');
    const title=document.createElement('h3');
    title.className='title';
    title.textContent=n.title||'Untitled';
    const meta=document.createElement('div');
    meta.className='meta';
    const d=new Date(n.updatedAt||n.createdAt);
    meta.textContent=d.toLocaleString();
    left.appendChild(title);left.appendChild(meta);
    const actions=document.createElement('div');
    actions.className='card-actions';
    const pinBtn=document.createElement('button'); pinBtn.className='ghost'; pinBtn.title='Pin'; pinBtn.textContent=n.pinned?'Unpin':'Pin';
    const editBtn=document.createElement('button'); editBtn.className='warning'; editBtn.textContent='Edit';
    const delBtn=document.createElement('button'); delBtn.className='danger'; delBtn.textContent='Delete';
    actions.appendChild(pinBtn);actions.appendChild(editBtn);actions.appendChild(delBtn);
    top.appendChild(left);top.appendChild(actions);
    const body=document.createElement('div'); body.className='body'; body.textContent=n.body||'';
    el.appendChild(top); el.appendChild(body);

    el.addEventListener('dblclick',()=>openEdit(n.id));
    editBtn.addEventListener('click',()=>openEdit(n.id));
    delBtn.addEventListener('click',()=>{notes=notes.filter(x=>x.id!==n.id);save();render()});
    pinBtn.addEventListener('click',()=>{n.pinned=!n.pinned;n.updatedAt=now();save();render()});

    return el;
  }

  function render(){
    const q=filter.trim().toLowerCase();
    const arr = notes.slice().sort((a,b)=>{
      if(a.pinned!==b.pinned) return a.pinned?-1:1;
      return new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt);
    });
    const filtered = q?arr.filter(n=>
      (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q)
    ):arr;
    const pinned = filtered.filter(n=>n.pinned);
    const others = filtered.filter(n=>!n.pinned);
    pinnedList.innerHTML='';
    notesList.innerHTML='';
    pinned.forEach(n=>pinnedList.appendChild(createCard(n)));
    others.forEach(n=>notesList.appendChild(createCard(n)));
  }

  addBtn.addEventListener('click',()=>{
    const title=titleInput.value.trim();
    const body=bodyInput.value.trim();
    if(!title && !body) return;
    const n={id:uid(),title,body,pinned:false,createdAt:now(),updatedAt:now()};
    notes.unshift(n);
    save();
    resetEditor();
    render();
  });

  clearBtn.addEventListener('click',resetEditor);
  newNoteBtn.addEventListener('click',()=>{titleInput.focus()});
  searchEl.addEventListener('input',e=>{filter=e.target.value;render()});

  saveEditBtn.addEventListener('click',()=>{
    if(!editingId) return;
    const n=notes.find(x=>x.id===editingId);
    if(!n) return;
    n.title=editTitle.value.trim();
    n.body=editBody.value.trim();
    n.updatedAt=now();
    save();
    closeEdit();
    render();
  });
  cancelEditBtn.addEventListener('click',closeEdit);
  editModal.addEventListener('click',e=>{if(e.target===editModal) closeEdit()});
  window.addEventListener('keydown',e=>{if(e.key==='Escape') closeEdit()});

  load();
  render();
})();
