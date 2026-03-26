import AdminPanel from './pages/AdminPanel';
import Dashboard from './pages/Dashboard';
import LeaveManagement from './pages/LeaveManagement';
import Overtime from './pages/Overtime';
import PayrollEntry from './pages/PayrollEntry';
import Payslips from './pages/Payslips';
import Profile from './pages/Profile';
import TrialUsers from './pages/TrialUsers';
import Welcome from './pages/Welcome';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminPanel": AdminPanel,
    "Dashboard": Dashboard,
    "LeaveManagement": LeaveManagement,
    "Overtime": Overtime,
    "PayrollEntry": PayrollEntry,
    "Payslips": Payslips,
    "Profile": Profile,
    "TrialUsers": TrialUsers,
    "Welcome": Welcome,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};