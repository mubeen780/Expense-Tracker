import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks';
import { useAuth } from '../AuthContext';
import { Card, ErrorBox, Loading, confirmDelete, useToast } from '../components/ui';

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useFetch(() => api.get('/payment-methods'), []);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const run = async (fn, msg) => { try { await fn(); toast(msg); reload(); } catch (e) { toast(e.message); } };
  const add = (e) => { e.preventDefault(); if (name.trim()) run(async () => { await api.post('/payment-methods', { name }); setName(''); }, 'Payment method added'); };
  const rename = (id) => run(async () => { await api.put(`/payment-methods/${id}`, { name: editName }); setEditId(null); }, 'Renamed');
  const remove = (m) => confirmDelete(`payment method "${m.name}" (its expenses become "Not specified")`) && run(() => api.del(`/payment-methods/${m.id}`), 'Deleted');

  return (
    <div className="stack">
      <div className="topbar"><div><h1>⚙️ Settings</h1><div className="muted">Account and dropdown lists.</div></div></div>
      <Card title="Account"><div><b>{user.name}</b> · <span className="muted">{user.email}</span></div>
        <p className="hint">Salary, thresholds and Need/Want guidelines live on the Budget page; categories too.</p></Card>
      <Card title="💳 Payment methods">
        <ErrorBox error={error} />
        {!data ? <Loading /> : (
          <div className="table-wrap"><table><tbody>
            {data.map((m) => (
              <tr key={m.id}>
                <td>{editId === m.id ? <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && rename(m.id)} /> : m.name}</td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  {editId === m.id ? <><button className="link" onClick={() => rename(m.id)}>Save</button><button className="link" onClick={() => setEditId(null)}>Cancel</button></>
                    : <><button className="link" onClick={() => { setEditId(m.id); setEditName(m.name); }}>Rename</button><button className="link danger" onClick={() => remove(m)}>Delete</button></>}
                </td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        <form className="row" style={{ marginTop: 12 }} onSubmit={add}>
          <input placeholder="New payment method…" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          <button className="primary">Add</button>
        </form>
      </Card>
    </div>
  );
}
