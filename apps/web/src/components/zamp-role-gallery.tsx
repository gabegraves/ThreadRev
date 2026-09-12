"use client";

import { useEffect, useRef, useState } from "react";
import type { RoleProfile } from "./zamp-role-data";
import { ZAMP_ROLE_PROFILES } from "./zamp-role-data";
import styles from "./zamp-role-gallery.module.css";

type RoleGalleryProps = {
  roles?: RoleProfile[];
  ariaLabel?: string;
  className?: string;
};

type DetailPosition = { left: number; top: number };

const DESKTOP_BREAKPOINT = 768;
const DETAIL_WIDTH = 516;
const DETAIL_ESTIMATED_HEIGHT = 440;
const DETAIL_GAP = 24;
const VIEWPORT_GUTTER = 16;

function DetailSections({ role }: { role: RoleProfile }) {
  return (
    <>
      {[
        ["Strengths:", role.strengths],
        ["Best used:", role.bestUsed],
        ["Output:", role.output],
      ].map(([label, body]) => (
        <section className={styles.detailSection} key={label}>
          <div className={styles.detailLabel}>{label}</div>
          <p className={styles.detailCopy}>{body}</p>
        </section>
      ))}
    </>
  );
}

function DetailHeader({ role }: { role: RoleProfile }) {
  return (
    <header className={styles.detailHeader}>
      <img className={styles.detailIcon} src={role.icon} alt="" />
      <h3 className={styles.detailTitle}>{role.title}</h3>
    </header>
  );
}

export function ZampRoleGallery({
  roles = ZAMP_ROLE_PROFILES,
  ariaLabel = "Available roles",
  className,
}: RoleGalleryProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [position, setPosition] = useState<DetailPosition>({ left: 16, top: 220 });
  const mobileDetailRef = useRef<HTMLDivElement>(null);
  const hoveredRole = hoveredIndex === null ? null : roles[hoveredIndex];
  const selectedRole = selectedIndex === null ? null : roles[selectedIndex];

  useEffect(() => {
    if (selectedIndex === null) return;
    const closeOnOutsidePress = (event: globalThis.PointerEvent) => {
      if (!mobileDetailRef.current?.contains(event.target as Node)) {
        setSelectedIndex(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedIndex]);

  const positionDetail = (clientX: number, clientY: number, index: number) => {
    if (window.innerWidth < DESKTOP_BREAKPOINT) return;
    const placeLeft = clientX + DETAIL_GAP + DETAIL_WIDTH > window.innerWidth;
    const proposedLeft = placeLeft
      ? clientX - DETAIL_GAP - DETAIL_WIDTH
      : clientX + DETAIL_GAP;
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(proposedLeft, window.innerWidth - DETAIL_WIDTH - VIEWPORT_GUTTER),
    );
    const halfHeight = DETAIL_ESTIMATED_HEIGHT / 2;
    const top = Math.max(
      VIEWPORT_GUTTER + halfHeight,
      Math.min(clientY, window.innerHeight - VIEWPORT_GUTTER - halfHeight),
    );
    setPosition({ left, top });
    setHoveredIndex(index);
  };

  return (
    <div className={[styles.gallery, className].filter(Boolean).join(" ")}>
      <div className={styles.grid} role="group" aria-label={ariaLabel}>
        <div className={styles.dividers} aria-hidden="true">
          {[20, 40, 60, 80].map((left) => (
            <span className={styles.divider} style={{ left: `${left}%` }} key={left} />
          ))}
        </div>

        {roles.map((role, index) => (
          <button
            className={styles.tile}
            type="button"
            key={`${role.title}-${index}`}
            aria-label={`View ${role.title} details`}
            aria-expanded={selectedIndex === index}
            onPointerMove={(event) => positionDetail(event.clientX, event.clientY, index)}
            onPointerLeave={() => setHoveredIndex(null)}
            onFocus={(event) => {
              if (window.innerWidth < DESKTOP_BREAKPOINT) return;
              const rect = event.currentTarget.getBoundingClientRect();
              positionDetail(rect.right, rect.top + rect.height / 2, index);
            }}
            onBlur={() => setHoveredIndex(null)}
            onClick={() => {
              if (window.innerWidth < DESKTOP_BREAKPOINT) setSelectedIndex(index);
            }}
          >
            <img className={styles.tileIcon} src={role.icon} alt="" />
            <span className={styles.tileLabel}>{role.title}</span>
          </button>
        ))}
      </div>

      {hoveredRole ? (
        <aside
          className={styles.desktopDetail}
          data-open="true"
          style={position}
          aria-hidden="true"
        >
          <DetailHeader role={hoveredRole} />
          <DetailSections role={hoveredRole} />
        </aside>
      ) : null}

      {selectedRole ? (
        <div
          className={styles.mobileDetail}
          ref={mobileDetailRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedRole.title} details`}
        >
          <div className={styles.mobileScroll}>
            <div className={styles.mobileHeader}>
              <button
                className={styles.close}
                type="button"
                aria-label="Close role details"
                onClick={() => setSelectedIndex(null)}
              >
                <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
                  <path d="M1 1l15 15M16 1L1 16" fill="none" stroke="currentColor" strokeWidth="2.6" />
                </svg>
              </button>
              <div className={styles.mobileIdentity}>
                <img className={styles.detailIcon} src={selectedRole.icon} alt="" />
                <h3 className={styles.detailTitle}>{selectedRole.title}</h3>
              </div>
            </div>
            <DetailSections role={selectedRole} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
