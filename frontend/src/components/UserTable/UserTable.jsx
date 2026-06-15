import styles from './UserTable.module.css';

const ROLE_MAP = {
  Administrator: 'admin',
  'Project Manager': 'pm',
  Collaborator: 'collaborator',
};

export default function UserTable({ users, onEdit, onToggleStatus }) {
  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div className={styles.userCell}>
                  <div className={styles.avatar}>{getInitials(u.name)}</div>
                  <span className={styles.name}>{u.name}</span>
                </div>
              </td>
              <td>{u.email}</td>
              <td>
                <span className={`${styles.roleBadge} ${styles[ROLE_MAP[u.role]]}`}>
                  {u.role}
                </span>
              </td>
              <td>
                <span className={`${styles.statusBadge} ${u.status === 'Active' ? styles.active : styles.inactive}`}>
                  {u.status}
                </span>
              </td>
              <td>
                <div className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => onEdit(u)}>
                    Edit
                  </button>
                  <button
                    className={`${styles.deactivateBtn} ${u.status === 'Inactive' ? styles.activateBtn : ''}`}
                    onClick={() => onToggleStatus(u)}
                  >
                    {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
