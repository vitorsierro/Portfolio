"use client";

import { usePathname, useRouter } from "next/navigation";
import AdminHeader from "../../components/AdminHeader/AdminHeader";
import styles from "../../styles/AdminLayout.module.css";
import { ROUTER_LOGIN } from "../../constants";
import { useEffect, useState } from "react";
import { ensureSession } from "../../lib/auth";

export default function AdminLayout({ children }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === ROUTER_LOGIN) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const authed = await ensureSession();
        if (!active) {
          return;
        }

        if (!authed) {
          router.replace(ROUTER_LOGIN);
          return;
        }
        setReady(true);
      } catch {
        if (active) {
          router.replace(ROUTER_LOGIN);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (pathname === ROUTER_LOGIN) {
    return children;
  }

  return (
    <div className={styles.root}>
      <AdminHeader />
      {ready ? children : <p className={styles.state}>Carregando…</p>}
    </div>
  );
}
