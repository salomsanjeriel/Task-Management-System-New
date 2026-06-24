import { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { taskService, dashboardService } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import KanbanColumn from '../../components/KanbanColumn/KanbanColumn';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { user, isAdmin, isProjectManager, isCollaborator } = useAuth();
  const [columns, setColumns] = useState({
    todo: [],
    inprogress: [],
    completed: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchDashboardTasks = async () => {
    try {
      setLoading(true);
      const res = await taskService.getAll();
      const dbTasks = res.data || [];
      const filteredTasks = isCollaborator
        ? dbTasks.filter((t) => t.assignments?.some((a) => a.user_id === user.id))
        : dbTasks;
      
      const cols = {
        todo: [],
        inprogress: [],
        completed: [],
      };

      filteredTasks.forEach((t) => {
        const mapped = {
          id: t.id,
          title: t.title,
          priority: t.priority === 'low' ? 'Low' : t.priority === 'medium' ? 'Medium' : 'High',
          dueDate: t.due_date ? t.due_date.substring(0, 10) : '',
          assignee: t.assignments?.[0]?.user?.name || 'Unassigned',
        };

        if (t.status === 'todo') {
          cols.todo.push(mapped);
        } else if (t.status === 'in_progress') {
          cols.inprogress.push(mapped);
        } else if (t.status === 'completed') {
          cols.completed.push(mapped);
        }
      });

      setColumns(cols);
      setError(null);
      
      const statsRes = await dashboardService.getStats();
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardTasks();
  }, []);

  useSocket('task:created', fetchDashboardTasks);
  useSocket('task:updated', fetchDashboardTasks);
  useSocket('task:deleted', fetchDashboardTasks);

  const handleDragEnd = async (result) => {
    if (isAdmin) return; // Admins are read-only
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceCol = [...columns[source.droppableId]];
    const destCol = source.droppableId === destination.droppableId
      ? sourceCol
      : [...columns[destination.droppableId]];

    const [moved] = sourceCol.splice(source.index, 1);
    destCol.splice(destination.index, 0, moved);

    setColumns((prev) => ({
      ...prev,
      [source.droppableId]: sourceCol,
      ...(source.droppableId !== destination.droppableId && {
        [destination.droppableId]: destCol,
      }),
    }));

    if (source.droppableId !== destination.droppableId) {
      const dbStatus = destination.droppableId === 'inprogress' ? 'in_progress' : destination.droppableId;
      try {
        await taskService.updateStatus(moved.id, dbStatus);
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to update task status on server');
        fetchDashboardTasks();
      }
    }
  };

  const filterTasks = (tasks) => {
    return tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  };

  const totalTasks = Object.values(columns).flat().length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Dashboard</h1>
          <p>Track and manage your project tasks</p>
        </div>
        <div className={styles.filters}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="🔍 Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="dashboard-search"
          />
          <select
            className={styles.filterSelect}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            id="priority-filter"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            id="status-filter"
          >
            <option value="All">All Status</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className={styles.stats}>
          {isAdmin && (
            <>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.total}`}>👥</div>
                <div className={styles.statInfo}><h3>{stats.totalUsers || 0}</h3><p>Total Users</p></div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.progress}`}>✅</div>
                <div className={styles.statInfo}><h3>{stats.activeUsers || 0}</h3><p>Active Users</p></div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.todo}`}>📁</div>
                <div className={styles.statInfo}><h3>{stats.totalProjects || 0}</h3><p>Total Projects</p></div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.done}`}>📋</div>
                <div className={styles.statInfo}><h3>{stats.totalTasks || 0}</h3><p>Total Tasks</p></div>
              </div>
            </>
          )}

          {isProjectManager && (
            <>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.total}`}>📁</div>
                <div className={styles.statInfo}><h3>{stats.managedProjects || 0}</h3><p>Managed Projects</p></div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.todo}`}>⏳</div>
                <div className={styles.statInfo}><h3>{stats.pendingTasks || 0}</h3><p>Pending Tasks</p></div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.done}`}>✅</div>
                <div className={styles.statInfo}><h3>{stats.completedTasks || 0}</h3><p>Completed Tasks</p></div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.progress}`}>📈</div>
                <div className={styles.statInfo}><h3>{stats.teamProgress || 0}%</h3><p>Team Progress</p></div>
              </div>
            </>
          )}

          {isCollaborator && (
            <>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.total}`}>📋</div>
                <div className={styles.statInfo}><h3>{stats.assignedTasks || 0}</h3><p>Assigned Tasks</p></div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.done}`}>✅</div>
                <div className={styles.statInfo}><h3>{stats.completedTasks || 0}</h3><p>Completed Tasks</p></div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.todo}`}>⏳</div>
                <div className={styles.statInfo}><h3>{stats.upcomingDeadlines || 0}</h3><p>Upcoming Deadlines</p></div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px', color: 'var(--text-secondary)' }}>
          Loading dashboard tasks...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px', color: 'red' }}>
          {error}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.board}>
            {(statusFilter === 'All' || statusFilter === 'To Do') && (
              <KanbanColumn
                title="To Do"
                tasks={filterTasks(columns.todo)}
                droppableId="todo"
              />
            )}
            {(statusFilter === 'All' || statusFilter === 'In Progress') && (
              <KanbanColumn
                title="In Progress"
                tasks={filterTasks(columns.inprogress)}
                droppableId="inprogress"
              />
            )}
            {(statusFilter === 'All' || statusFilter === 'Completed') && (
              <KanbanColumn
                title="Completed"
                tasks={filterTasks(columns.completed)}
                droppableId="completed"
              />
            )}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
