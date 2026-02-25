
import React, { useEffect, useState } from 'react';
import { User, UserRole, Language } from '../types';
import { getAllUsers, addUserMock, updateUserMock, deleteUserMock } from '../services/mockService';
// In production, uncomment the following line and replace the mock functions:
// import { fetchUsers, addUser, updateUser, deleteUser } from '../services/firebaseUserService';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search,
  Shield,
  Briefcase,
  User as UserIcon,
  Filter
} from 'lucide-react';

interface UserManagementProps {
  currentUser: User;
  language: Language;
}

const TEXTS = {
  headerTitle: { EN: 'User Management', GE: 'მომხმარებლები' },
  headerDesc: { EN: 'Manage company structure and access roles.', GE: 'კომპანიის სტრუქტურისა და როლების მართვა.' },
  addUser: { EN: 'Add User', GE: 'მომხმარებლის დამატება' },
  searchPlaceholder: { EN: 'Search users...', GE: 'ძებნა...' },
  
  // Table Headers
  colName: { EN: 'Name / Email', GE: 'სახელი / მეილი' },
  colRole: { EN: 'Role', GE: 'როლი' },
  colDept: { EN: 'Department', GE: 'დეპარტამენტი' },
  colManager: { EN: 'Direct Manager', GE: 'ხელმძღვანელი' },
  colActions: { EN: 'Actions', GE: 'მოქმედებები' },

  // Modal
  editUser: { EN: 'Edit User', GE: 'მომხმარებლის რედაქტირება' },
  newUser: { EN: 'Add New User', GE: 'ახალი მომხმარებლის დამატება' },
  labelName: { EN: 'Full Name', GE: 'სრული სახელი' },
  labelEmail: { EN: 'Email', GE: 'ელ. ფოსტა' },
  labelRole: { EN: 'Role', GE: 'როლი' },
  labelDept: { EN: 'Department', GE: 'დეპარტამენტი' },
  labelManager: { EN: 'Direct Manager', GE: 'უშუალო ხელმძღვანელი' },
  btnCancel: { EN: 'Cancel', GE: 'გაუქმება' },
  btnSave: { EN: 'Save', GE: 'შენახვა' },
  
  deleteConfirm: { EN: 'Are you sure you want to delete this user?', GE: 'დარწმუნებული ხართ რომ გსურთ მომხმარებლის წაშლა?' },
  noUsers: { EN: 'No users found.', GE: 'მომხმარებლები არ მოიძებნა.' }
};

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser, language }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: UserRole.EMPLOYEE,
    department: '',
    managerId: ''
  });

  const t = (key: keyof typeof TEXTS) => TEXTS[key][language];

  const loadUsers = async () => {
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const getManagerName = (managerId?: string) => {
    if (!managerId) return <span className="text-gray-400 italic">Top Level</span>;
    const manager = users.find(u => u.id === managerId);
    return manager ? manager.name : <span className="text-red-400">Unknown</span>;
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        managerId: user.managerId || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: UserRole.EMPLOYEE,
        department: '',
        managerId: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUserMock(editingUser.id, formData);
      } else {
        await addUserMock(formData);
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err) {
      console.error(err);
      alert('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('deleteConfirm'))) {
      await deleteUserMock(id);
      loadUsers();
    }
  };

  const RoleBadge = ({ role }: { role: UserRole }) => {
     let color = 'bg-gray-100 text-gray-700';
     if (role === UserRole.FOUNDER) color = 'bg-black text-white';
     if (role === UserRole.FIN_DIRECTOR) color = 'bg-gray-800 text-white';
     if (role === UserRole.MANAGER) color = 'bg-gray-200 text-black';
     
     return (
       <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${color}`}>
         {role}
       </span>
     );
  };

  if (loading) return <div className="p-12 text-center text-gray-500">იტვირთება...</div>;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-black tracking-tight">{t('headerTitle')}</h2>
          <p className="text-gray-500 mt-1">{t('headerDesc')}</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded font-bold hover:bg-gray-800 transition-colors w-full md:w-auto"
        >
          <Plus size={18} />
          {t('addUser')}
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder={t('searchPlaceholder')}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded focus:border-black focus:ring-1 focus:ring-black outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Responsive Layout: Table on Desktop, Cards on Mobile */}
      
      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
             <tr>
               <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t('colName')}</th>
               <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t('colRole')}</th>
               <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t('colDept')}</th>
               <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{t('colManager')}</th>
               <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">{t('colActions')}</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 group">
                <td className="px-6 py-4">
                  <div className="font-bold text-black">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-700">
                  {user.department}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-700">
                   <div className="flex items-center gap-1.5">
                     <UserIcon size={14} className="text-gray-400" />
                     {getManagerName(user.managerId)}
                   </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(user)} className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white p-4 border border-gray-200 rounded shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-black">{user.name}</h3>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <RoleBadge role={user.role} />
            </div>
            
            <div className="space-y-2 text-sm text-gray-700 mb-4">
               <div className="flex justify-between">
                 <span className="text-gray-500">{t('colDept')}:</span>
                 <span className="font-medium">{user.department}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-gray-500">{t('colManager')}:</span>
                 <span className="font-medium flex items-center gap-1">
                    {getManagerName(user.managerId)}
                 </span>
               </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100">
               <button 
                 onClick={() => handleOpenModal(user)}
                 className="flex-1 py-2 bg-gray-50 text-black text-xs font-bold rounded hover:bg-gray-100 flex items-center justify-center gap-2"
               >
                 <Edit2 size={14} /> {t('btnSave')}
               </button>
               <button 
                 onClick={() => handleDelete(user.id)}
                 className="flex-1 py-2 bg-red-50 text-red-600 text-xs font-bold rounded hover:bg-red-100 flex items-center justify-center gap-2"
               >
                 <Trash2 size={14} /> {t('btnCancel')}
               </button>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded">
          {t('noUsers')}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold">{editingUser ? t('editUser') : t('newUser')}</h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('labelName')}</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-black focus:ring-1 focus:ring-black outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('labelEmail')}</label>
                <input 
                  type="email" 
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-black focus:ring-1 focus:ring-black outline-none"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('labelRole')}</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:border-black outline-none bg-white"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  >
                    {Object.values(UserRole).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('labelDept')}</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:border-black outline-none"
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('labelManager')}</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-black outline-none bg-white"
                  value={formData.managerId}
                  onChange={e => setFormData({...formData, managerId: e.target.value})}
                >
                  <option value="">(None / Top Level)</option>
                  {users.filter(u => u.id !== editingUser?.id).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} - {u.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded"
                >
                  {t('btnCancel')}
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-black text-white font-bold rounded hover:bg-gray-800"
                >
                  {t('btnSave')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
