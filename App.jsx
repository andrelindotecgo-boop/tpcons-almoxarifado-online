import React, { useEffect, useMemo, useState } from 'react';
import { Building2, LogOut, Plus, RefreshCw, Trash2, Pencil, Users, Shield } from 'lucide-react';

const SUPA_URL = 'https://qltkepywsfvwwoorooit.supabase.co';
const SUPA_KEY = 'sb_publishable_M7B7NLCNR5RvdNl2oINabw_FK2lUph3';
const TABLE = 'almox_database';
const RECORD = 'tpcons_almoxarifado_online_v1';
const LOCAL_KEY = 'tpcons_almoxarifado_online_v1';

function nowBR() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
}

function hash(v) {
  let h = 0;
  const s = 'TPCONS_' + String(v || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return 'h_' + Math.abs(h);
}

const initialUsers = [
  { id: 1, nome: 'Andre Paulo', login: 'admin', senhaHash: hash('admin1'), perfil: 'ADMIN', status: 'Ativo' },
  { id: 2, nome: 'Almoxarife', login: 'Almoxarife', senhaHash: hash('fossoaod'), perfil: 'EDITOR', status: 'Ativo' }
];

const initialDb = {
  version: Date.now(),
  updatedAt: nowBR(),
  updatedBy: 'Sistema',
  users: initialUsers,
  obras: [
    {
      id: 1,
      nomeObra: 'CONSTRUÇÃO DO FOSSO AOD',
      cliente: 'VILLARES METALS',
      status: 'Ativa',
      colaboradores: []
    }
  ]
};

function normalize(db) {
  const base = db && db.obras ? db : initialDb;
  return {
    ...base,
    users: base.users?.length ? base.users : initialUsers,
    obras: (base.obras?.length ? base.obras : initialDb.obras).map((obra, idx) => ({
      id: obra.id || Date.now() + idx,
      nomeObra: obra.nomeObra || 'OBRA SEM NOME',
      cliente: obra.cliente || '',
      status: obra.status || 'Ativa',
      colaboradores: obra.colaboradores || obra.collaborators || []
    }))
  };
}

function loadLocal() {
  try {
    return normalize(JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'));
  } catch {
    return initialDb;
  }
}

function saveLocal(db) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(normalize(db)));
}

async function fetchDb() {
  const url = `${SUPA_URL}/rest/v1/${TABLE}?id=eq.${RECORD}&select=data`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`
    }
  });
  if (!res.ok) throw new Error(`Erro ao ler Supabase: ${res.status}`);
  const json = await res.json();
  return json?.[0]?.data ? normalize(json[0].data) : null;
}

async function pushDb(db) {
  const clean = normalize(db);
  const url = `${SUPA_URL}/rest/v1/${TABLE}?on_conflict=id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify({ id: RECORD, data: clean })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erro ao salvar Supabase: ${res.status} ${txt}`);
  }
  return true;
}

export default function App() {
  const [db, setDb] = useState(loadLocal);
  const [user, setUser] = useState(null);
  const [obraId, setObraId] = useState(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const online = await fetchDb();
      const data = online || loadLocal();
      setDb(data);
      saveLocal(data);
      setMsg('ONLINE recarregado em ' + nowBR());
    } catch (e) {
      setMsg('Falha online: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function write(nextDb) {
    const clean = normalize({ ...nextDb, version: Date.now(), updatedAt: nowBR(), updatedBy: user?.login || 'Sistema' });
    setDb(clean);
    saveLocal(clean);
    try {
      await pushDb(clean);
      setMsg('ONLINE salvo em ' + nowBR());
    } catch (e) {
      setMsg('Falha ao salvar online: ' + e.message);
    }
  }

  async function login(login, senha) {
    let base = db;
    try {
      const online = await fetchDb();
      if (online) base = online;
    } catch {}
    const found = base.users.find(u => u.login === login && u.senhaHash === hash(senha) && u.status !== 'Inativo');
    if (!found) return 'Usuário ou senha inválidos';
    setDb(base);
    saveLocal(base);
    setUser(found);
    setObraId(null);
    return '';
  }

  if (!user) return <Login onLogin={login} />;
  if (!obraId) return <Obras db={db} user={user} setUser={setUser} setObraId={setObraId} write={write} reload={reload} msg={msg} loading={loading} />;

  const obra = db.obras.find(o => +o.id === +obraId) || db.obras[0];

  async function updateObra(patch) {
    const obras = db.obras.map(o => +o.id === +obra.id ? { ...o, ...patch } : o);
    await write({ ...db, obras });
  }

  return <Sistema db={db} user={user} obra={obra} setObraId={setObraId} updateObra={updateObra} reload={reload} msg={msg} loading={loading} />;
}

function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function entrar() {
    const r = await onLogin(login, senha);
    setErro(r);
  }

  return (
    <div className="loginPage">
      <div className="loginCard">
        <p className="sub">TPCONS</p>
        <h1>Almoxarifado Online</h1>
        <input placeholder="Usuário" value={login} onChange={e => setLogin(e.target.value)} />
        <input placeholder="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()} />
        {erro && <p className="error">{erro}</p>}
        <button className="btn" onClick={entrar}>Entrar</button>
        <p className="small">admin/admin1 ou Almoxarife/fossoaod</p>
      </div>
    </div>
  );
}

function Obras({ db, user, setUser, setObraId, write, reload, msg, loading }) {
  const [open, setOpen] = useState(false);

  async function criarObra(form) {
    await write({
      ...db,
      obras: [...db.obras, { id: Date.now(), nomeObra: form.nomeObra, cliente: form.cliente, status: 'Ativa', colaboradores: [] }]
    });
    setOpen(false);
  }

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <p className="sub">TPCONS</p>
          <h1>Selecionar Obra</h1>
          <p className="ok">{msg}</p>
        </div>
        <div className="actions">
          <button className="btn light" onClick={reload}><RefreshCw size={16}/> {loading ? 'Atualizando...' : 'Atualizar'}</button>
          {user.perfil === 'ADMIN' && <button className="btn" onClick={() => setOpen(true)}><Plus size={16}/> Nova Obra</button>}
          <button className="btn light" onClick={() => setUser(null)}><LogOut size={16}/> Sair</button>
        </div>
      </div>

      <div className="cards">
        {db.obras.map(obra => (
          <div className="card" key={obra.id}>
            <p className="sub">OBRA</p>
            <h2>{obra.nomeObra}</h2>
            <p><b>Cliente:</b> {obra.cliente}</p>
            <p><b>Status:</b> {obra.status}</p>
            <p><b>Colaboradores:</b> {obra.colaboradores.length}</p>
            <button className="btn green" onClick={() => setObraId(obra.id)}>Acessar Obra</button>
          </div>
        ))}
      </div>

      {open && <NovaObra onClose={() => setOpen(false)} onSave={criarObra} />}
    </main>
  );
}

function Sistema({ db, user, obra, setObraId, updateObra, reload, msg, loading }) {
  const [openCol, setOpenCol] = useState(false);
  const [editCol, setEditCol] = useState(null);

  async function salvarColaborador(form) {
    const lista = editCol
      ? obra.colaboradores.map(c => c.id === editCol.id ? { ...form, id: editCol.id } : c)
      : [...obra.colaboradores, { ...form, id: Date.now() }];
    await updateObra({ colaboradores: lista });
    setOpenCol(false);
    setEditCol(null);
  }

  async function excluirColaborador(id) {
    await updateObra({ colaboradores: obra.colaboradores.filter(c => c.id !== id) });
  }

  return (
    <div className="layout">
      <aside>
        <h2>TPCONS<br/>Almoxarifado</h2>
        <div className="userBox">
          <b>{user.nome}</b>
          <span>{user.perfil}</span>
        </div>
        <button className="btn light full" onClick={() => setObraId(null)}><Building2 size={16}/> Trocar Obra</button>
        <button className="menu active"><Users size={16}/> Colaboradores</button>
        {user.perfil === 'ADMIN' && <button className="menu"><Shield size={16}/> Usuários</button>}
      </aside>

      <main className="content">
        <section className="box topbar">
          <div>
            <p className="sub">OBRA ATUAL</p>
            <b>OBRA:</b> {obra.nomeObra}<br/>
            <b>CLIENTE:</b> {obra.cliente}<br/>
            <span className="small">Última sincronização: {db.updatedAt} • {db.updatedBy} • Modo ONLINE SUPABASE</span>
            <p className="ok">{msg}</p>
          </div>
          <button className="btn light" onClick={reload}><RefreshCw size={16}/> {loading ? 'Atualizando...' : 'Atualizar'}</button>
        </section>

        <div className="topbar">
          <h1>Colaboradores</h1>
          <button className="btn" onClick={() => { setEditCol(null); setOpenCol(true); }}><Plus size={16}/> Novo colaborador</button>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Função</th><th>Matrícula/CPF</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {obra.colaboradores.map(c => (
                <tr key={c.id}>
                  <td><b>{c.nome}</b></td>
                  <td>{c.funcao}</td>
                  <td>{c.matricula}</td>
                  <td>
                    <button className="icon" onClick={() => { setEditCol(c); setOpenCol(true); }}><Pencil size={15}/></button>
                    {user.perfil === 'ADMIN' && <button className="icon red" onClick={() => excluirColaborador(c.id)}><Trash2 size={15}/></button>}
                  </td>
                </tr>
              ))}
              {!obra.colaboradores.length && <tr><td colSpan="4">Nenhum colaborador cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>

        {openCol && <ColModal col={editCol} onClose={() => setOpenCol(false)} onSave={salvarColaborador} />}
      </main>
    </div>
  );
}

function NovaObra({ onClose, onSave }) {
  const [form, setForm] = useState({ nomeObra: '', cliente: '' });
  return <Modal title="Nova Obra" onClose={onClose} onSave={() => onSave(form)}>
    <Field label="Nome da obra" value={form.nomeObra} onChange={v => setForm({ ...form, nomeObra: v })}/>
    <Field label="Cliente" value={form.cliente} onChange={v => setForm({ ...form, cliente: v })}/>
  </Modal>;
}

function ColModal({ col, onClose, onSave }) {
  const [form, setForm] = useState(col || { nome: '', funcao: '', matricula: '' });
  return <Modal title={col ? 'Editar colaborador' : 'Novo colaborador'} onClose={onClose} onSave={() => onSave(form)}>
    <Field label="Nome" value={form.nome} onChange={v => setForm({ ...form, nome: v })}/>
    <Field label="Função" value={form.funcao} onChange={v => setForm({ ...form, funcao: v })}/>
    <Field label="Matrícula/CPF" value={form.matricula} onChange={v => setForm({ ...form, matricula: v })}/>
  </Modal>;
}

function Modal({ title, children, onClose, onSave }) {
  return <div className="modal">
    <div className="modalCard">
      <div className="topbar">
        <h1>{title}</h1>
        <button className="btn light" onClick={onClose}>×</button>
      </div>
      {children}
      <div className="actions end">
        <button className="btn light" onClick={onClose}>Cancelar</button>
        <button className="btn" onClick={onSave}>Salvar</button>
      </div>
    </div>
  </div>;
}

function Field({ label, value, onChange }) {
  return <label className="field">
    {label}
    <input value={value || ''} onChange={e => onChange(e.target.value)} />
  </label>;
}
