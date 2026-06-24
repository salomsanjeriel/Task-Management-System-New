import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },

  {
    to: '/projects',
    icon: '📁',
    label: 'Projects',
    allowedRoles: ['project_manager']
  },

  {
    to: '/tasks',
    icon: '📋',
    label: 'Tasks',
    allowedRoles: ['project_manager', 'collaborator']
  },

  {
    to: '/tasks/create',
    icon: '➕',
    label: 'Create Task',
    allowedRoles: ['project_manager']
  },

  {
    to: '/users',
    icon: '👥',
    label: 'User Management',
    allowedRoles: ['admin']
  },

  { to: '/notifications', icon: '🔔', label: 'Notifications' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredItems = NAV_ITEMS.filter((item) => {
    if (!item.allowedRoles) return true;
    return item.allowedRoles.includes(user?.role);
  });

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logoSection}>
        <div className={styles.logoIcon}>T</div>
        <span className={styles.logoText}>TaskFlow</span>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </NavLink>
        ))}

        <div className={styles.divider} />

        <button className={styles.navItem} onClick={handleLogout}>
          <span className={styles.navIcon}>🚪</span>
          <span className={styles.navLabel}>Logout</span>
        </button>
      </nav>

      {/* Toggle */}
      <div className={styles.bottomSection}>
        <button className={styles.toggleBtn} onClick={onToggle}>
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
    </aside>
  );
}