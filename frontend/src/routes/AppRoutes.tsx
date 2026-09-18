import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/layout/Layout'
import ProtectedRoute from '../components/ui/ProtectedRoute'
import RoleRoute from '../components/ui/RoleRoute'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Employees from '../pages/Employees'
import EmployeeDetails from '../pages/EmployeeDetails'
import Departments from '../pages/Departments'
import DepartmentDetails from '../pages/DepartmentDetails'
import Tasks from '../pages/Tasks'
import TaskDetails from '../pages/TaskDetails'
import Productivity from '../pages/Productivity'
import Reports from '../pages/Reports'
import Notifications from '../pages/Notifications'
import Audit from '../pages/Audit'
import Profile from '../pages/Profile'

export default function AppRoutes() {
  const { logout } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout onLogout={logout} />}>
            <Route path="/" element={<Dashboard />} />

            <Route element={<RoleRoute roles={['CEO', 'MANAGER']} />}>
              <Route path="/employees" element={<Employees />} />
              <Route path="/employees/:id" element={<EmployeeDetails />} />
            </Route>

            <Route element={<RoleRoute roles={['CEO']} />}>
              <Route path="/departments" element={<Departments />} />
              <Route path="/departments/:id" element={<DepartmentDetails />} />
              <Route path="/audit" element={<Audit />} />
            </Route>

            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/:id" element={<TaskDetails />} />
            <Route path="/productivity" element={<Productivity />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />

            <Route element={<RoleRoute roles={['CEO', 'MANAGER']} />}>
              <Route path="/delegar" element={<Tasks autoNew />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
