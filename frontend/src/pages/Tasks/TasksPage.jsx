import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';
import styles from './TasksPage.module.css';

const ITEMS_PER_PAGE = 8;

const STATUS_MAP = {
  'To Do': 'todo',
  'In Progress': 'inprogress',
  Completed: 'completed',
};

export default function TasksPage() {
  const navigate = useNavigate();
  const { user, isCollaborator, isProjectManager } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTask, setDeleteTask] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await taskService.getAll();
      const dbTasks = res.data || [];
      const filteredTasks = isCollaborator
        ? dbTasks.filter((t) => t.assignments?.some((a) => a.user_id === user.id))
        : dbTasks;
      const mappedTasks = filteredTasks.map((t) => ({
        id: t.id,
        title: t.title,
        assignee: t.assignments?.[0]?.user?.name || 'Unassigned',
        priority: t.priority === 'low' ? 'Low' : t.priority === 'medium' ? 'Medium' : 'High',
        status: t.status === 'todo' ? 'To Do' : t.status === 'in_progress' ? 'In Progress' : 'Completed',
        dueDate: t.due_date ? t.due_date.substring(0, 10) : '',
        project: t.project?.name || 'No Project'
      }));
      setTasks(mappedTasks);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useSocket('task:created', fetchTasks);
  useSocket('task:updated', fetchTasks);
  useSocket('task:deleted', fetchTasks);

  const filtered = tasks.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignee.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchSearch && matchPriority && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleDelete = async () => {
    if (deleteTask) {
      try {
        await taskService.delete(deleteTask.id);
        setTasks((prev) => prev.filter((t) => t.id !== deleteTask.id));
        setDeleteTask(null);
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to delete task');
      }
    }
  };

  const getInitials = (name) => name.split(' ').map((n) => n[0]).join('');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Tasks</h1>
          <p>{filtered.length} tasks found</p>
        </div>
        <div className={styles.controls}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="🔍 Search tasks..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            id="tasks-search"
          />
          <select
            className={styles.filterSelect}
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="All">All Status</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          {isProjectManager && (
            <button className={styles.createBtn} onClick={() => navigate('/tasks/create')} id="create-task-btn">
              ➕ New Task
            </button>
          )}
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.emptyState}>Loading tasks...</div>
        ) : error ? (
          <div className={styles.emptyState} style={{ color: 'red' }}>{error}</div>
        ) : paginated.length > 0 ? (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Project</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((task) => (
                  <tr key={task.id}>
                    <td style={{ fontWeight: 600 }}>{task.title}</td>
                    <td>{task.project}</td>
                    <td>
                      <div className={styles.assigneeCell}>
                        <div className={styles.assigneeAvatar}>{getInitials(task.assignee)}</div>
                        {task.assignee}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.priorityBadge} ${styles[task.priority.toLowerCase()]}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[STATUS_MAP[task.status]]}`}>
                        {task.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{task.dueDate}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => navigate(`/tasks/edit/${task.id}`)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        {isProjectManager && (
                          <button
                            className={`${styles.actionBtn} ${styles.delete}`}
                            onClick={() => setDeleteTask(task)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.pagination}>
              <span className={styles.pageInfo}>
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className={styles.pageButtons}>
                <button
                  className={styles.pageBtn}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`${styles.pageBtn} ${page === currentPage ? styles.active : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className={styles.pageBtn}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage === totalPages}
                >
                  ›
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <div style={{ fontSize: '48px' }}>📭</div>
            <p>No tasks found matching your filters</p>
          </div>
        )}
      </div>

      {deleteTask && (
        <ConfirmationModal
          title="Delete Task"
          message={`Are you sure you want to delete "${deleteTask.title}"? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTask(null)}
        />
      )}
    </div>
  );
}
