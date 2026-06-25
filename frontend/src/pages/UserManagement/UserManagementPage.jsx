import { useState, useEffect } from 'react';
import api, { userService } from '../../services/api';
import UserTable from '../../components/UserTable/UserTable';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';
import styles from './UserManagementPage.module.css';

const ROLE_MAP_FROM_DB = {
  'admin': 'Administrator',
  'project_manager': 'Project Manager',
  'collaborator': 'Collaborator'
};

const ROLE_MAP_TO_DB = {
  'Administrator': 'admin',
  'Project Manager': 'project_manager',
  'Collaborator': 'collaborator'
};

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalForm, setModalForm] = useState({ name: '', email: '', role: 'Collaborator' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Success state for displaying temp password
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  // Confirmation Modal
  const [statusConfirmUser, setStatusConfirmUser] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await userService.getAll();
      const mapped = (res.data || []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: ROLE_MAP_FROM_DB[u.role] || u.role,
        status: u.is_active ? 'Active' : 'Inactive'
      }));
      setUsers(mapped);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setModalForm({ name: '', email: '', role: 'Collaborator' });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setModalForm({ name: user.name, email: user.email, role: user.role });
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!modalForm.name.trim()) errs.name = 'Name is required';
    if (!modalForm.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(modalForm.email)) errs.email = 'Enter a valid email';
    return errs;
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setTempPasswordInfo(null);
    try {
      if (editingUser) {
        await userService.update(editingUser.id, {
          name: modalForm.name,
          email: modalForm.email
        });

        if (editingUser.role !== modalForm.role) {
          await api.patch(`/users/${editingUser.id}/role`, {
            role: ROLE_MAP_TO_DB[modalForm.role]
          });
        }
      } else {
        const res = await userService.create({
          name: modalForm.name,
          email: modalForm.email,
          role: ROLE_MAP_TO_DB[modalForm.role]
        });

        if (res.data?.temp_password) {
          setTempPasswordInfo({
            email: modalForm.email,
            tempPassword: res.data.temp_password
          });
        }
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (statusConfirmUser) {
      try {
        if (statusConfirmUser.status === 'Active') {
          await userService.deactivate(statusConfirmUser.id);
        } else {
          await userService.activate(statusConfirmUser.id);
        }
        setStatusConfirmUser(null);
        fetchUsers();
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to update user status');
      }
    }
  };

  return (
    <div className={styles.page}>
      {tempPasswordInfo && (
        <div style={{
          backgroundColor: '#e6fffa',
          border: '1px solid #319795',
          color: '#234e52',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Success! User Created!</strong> <br />
            Email: <code>{tempPasswordInfo.email}</code> <br />
            Temporary Password: <code>{tempPasswordInfo.tempPassword}</code> <br />
            <span style={{ fontSize: '12px', color: '#4a5568' }}>Please copy this password and share it with the collaborator. They can use it to log in.</span>
          </div>
          <button
            onClick={() => setTempPasswordInfo(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
          >
            ❌
          </button>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>User Management</h1>
          <p>Create, edit, and deactivate team members</p>
        </div>
        <div className={styles.controls}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="🔍 Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="user-search"
          />
          <select
            className={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            id="role-filter"
          >
            <option value="All">All Roles</option>
            <option value="Administrator">Administrator</option>
            <option value="Project Manager">Project Manager</option>
            <option value="Collaborator">Collaborator</option>
          </select>
          <button className={styles.createBtn} onClick={openCreateModal} id="create-user-btn">
            ➕ Add User
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px', color: 'var(--text-secondary)' }}>
          Loading users...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px', color: 'red' }}>
          {error}
        </div>
      ) : (
        <UserTable
          users={filtered}
          onEdit={openEditModal}
          onToggleStatus={(u) => setStatusConfirmUser(u)}
        />
      )}

      {/* User Create/Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>{editingUser ? 'Edit User' : 'Add New User'}</h3>
            <form className={styles.form} onSubmit={handleSaveUser} noValidate>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="modal-name">
                  Full Name <span className={styles.required}>*</span>
                </label>
                <input
                  id="modal-name"
                  type="text"
                  className={styles.input}
                  value={modalForm.name}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="modal-email">
                  Email Address <span className={styles.required}>*</span>
                </label>
                <input
                  id="modal-email"
                  type="email"
                  className={styles.input}
                  value={modalForm.email}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="modal-role">Role</label>
                <select
                  id="modal-role"
                  className={styles.select}
                  value={modalForm.role}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Collaborator">Collaborator</option>
                </select>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? 'Saving...' : (editingUser ? 'Save Changes' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation for Deactivation/Activation */}
      {statusConfirmUser && (
        <ConfirmationModal
          title={statusConfirmUser.status === 'Active' ? 'Deactivate User' : 'Activate User'}
          message={`Are you sure you want to ${
            statusConfirmUser.status === 'Active' ? 'deactivate' : 'activate'
          } ${statusConfirmUser.name}?`}
          confirmText={statusConfirmUser.status === 'Active' ? 'Deactivate' : 'Activate'}
          variant={statusConfirmUser.status === 'Active' ? 'danger' : 'warning'}
          onConfirm={handleToggleStatus}
          onCancel={() => setStatusConfirmUser(null)}
        />
      )}
    </div>
  );
}
