import {
  BookOpen,
  ChartNoAxesCombined,
  GraduationCap,
  LayoutGrid,
  Sparkles,
  Sun,
  Wrench,
} from "lucide-react";
import { Link, NavLink, Outlet, useMatch } from "react-router-dom";
import { MiaPanel } from "../features/mia/MiaPanel";
import { useMiaStore } from "../features/mia/store";

const destinations = [
  { href: "/", label: "今日", icon: Sun },
  { href: "/courses", label: "课程", icon: BookOpen },
  { href: "/tools", label: "工具", icon: Wrench },
  { href: "/space", label: "空间", icon: LayoutGrid },
  { href: "/growth", label: "成长", icon: ChartNoAxesCombined },
];

function Brand() {
  return (
    <Link to="/" className="app-brand" aria-label="爱学纪首页">
      <span className="app-brand__mark" aria-hidden="true">
        <GraduationCap size={23} strokeWidth={1.75} />
      </span>
      <span className="app-brand__words">
        <span className="app-brand__name">爱学纪</span>
        <span className="app-brand__caption">AI 学习空间</span>
      </span>
    </Link>
  );
}

function Navigation({ className }: { className: string }) {
  return (
    <nav className={className} aria-label="主导航">
      <ul className="app-nav__list">
        {destinations.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <NavLink className="app-nav__link" to={href} end={href === "/"}>
              <Icon size={21} strokeWidth={1.85} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DemoStatus() {
  return (
    <span className="demo-status">
      <span className="demo-status__dot" aria-hidden="true" />
      模拟演示
    </span>
  );
}

export function AppShell() {
  const miaOpen = useMiaStore((state) => state.open);
  const openMia = useMiaStore((state) => state.openFromPage);
  const materialRoute = useMatch("/courses/:courseId/materials/:materialId");

  return (
    <div
      className={`app-shell${miaOpen && materialRoute ? " app-shell--mia-docked" : ""}`}
    >
      <a className="app-skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="app-sidebar">
        <Brand />
        <p className="app-sidebar__label">学习工作台</p>
        <Navigation className="app-desktop-nav" />
        <div className="app-sidebar__footer">
          <div className="app-sidebar__profile">
            <span className="app-sidebar__avatar" aria-hidden="true">
              学
            </span>
            <span className="app-sidebar__profile-name">我的学纪</span>
          </div>
          <DemoStatus />
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-mobile-header">
          <Brand />
          <DemoStatus />
        </header>
        <main className="app-main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Navigation className="app-bottom-nav" />
      <button
        type="button"
        className="mia-launcher"
        aria-label="打开 Mia"
        aria-haspopup="dialog"
        aria-expanded={miaOpen}
        hidden={miaOpen}
        onClick={openMia}
      >
        <span className="mia-launcher__mark" aria-hidden="true">
          <Sparkles size={23} strokeWidth={1.8} />
        </span>
        <span className="mia-launcher__label">Mia</span>
      </button>
      <MiaPanel />
    </div>
  );
}
