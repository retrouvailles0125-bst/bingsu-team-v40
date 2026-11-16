
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './universe.module.css';

const houses = [
  {
    id: 'treasury',
    name: 'Ngân Khố',
    image: '/universe/ngan-kho.png',
    href: '/tracking',
    description: 'Donate và thống kê',
  },
  {
    id: 'guild',
    name: 'Thương Hội',
    image: '/universe/thuong-hoi.png',
    href: '/star',
    description: 'Ngôi Sao May Mắn',
  },
  {
    id: 'residence',
    name: 'Tư Dinh',
    image: '/universe/tu-dinh.png',
    href: '/account',
    description: 'Tài khoản của tôi',
  },
  {
    id: 'teahouse',
    name: 'Trà Thất',
    image: '/universe/tra-that.png',
    href: '/love',
    description: 'Yêu thương gửi Trang',
  },
  {
    id: 'embassy',
    name: 'Sứ Quán',
    image: '/universe/su-quan.png',
    href: '/embassy',
    description: 'Các Project từng thực hiện',
  },
] as const;

type HouseId = (typeof houses)[number]['id'];

export default function UniverseMap() {
  const router = useRouter();

  const [leaving, setLeaving] = useState(false);
  const [selected, setSelected] = useState<HouseId | null>(null);

  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;

    const assets = houses.map((house) => ({
      id: house.id,
      src: house.image,
    }));

    assets.forEach((asset) => {
      const img = new window.Image();

      const markLoaded = (success: boolean) => {
        if (!active) return;

        setLoaded((previous) => ({
          ...previous,
          [asset.id]: success,
        }));
      };

      img.onload = () => markLoaded(true);
      img.onerror = () => markLoaded(false);
      img.src = asset.src;
    });

    return () => {
      active = false;
    };
  }, []);

  function go(href: string, id: HouseId) {
    if (leaving) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reduceMotion) {
      router.push(href);
      return;
    }

    setSelected(id);
    setLeaving(true);

    window.setTimeout(() => {
      router.push(href);
    }, 200);
  }

  return (
    <main
      id="bst-universe"
      className={styles.root}
      aria-label="Bản đồ BST Universe"
    >
      <div className={styles.viewport}>
        <div
          className={[
            styles.map,
            leaving ? styles.leaving : '',
          ].filter(Boolean).join(' ')}
        >
          <div className={styles.fallbackMap} aria-hidden="true" />

          <picture>
            <source
              media="(min-width: 768px)"
              srcSet="/universe/background-desktop.jpg"
            />
            <img
              className={styles.background}
              src="/universe/background.png"
              alt="Bản đồ BST Universe"
              draggable={false}
            />
          </picture>

          {houses.map((house) => {
            const isSelected = selected === house.id;

            return (
              <button
                type="button"
                key={house.id}
                className={[
                  styles.house,
                  styles[house.id],
                  isSelected ? styles.selected : '',
                ].filter(Boolean).join(' ')}
                onClick={() => go(house.href, house.id)}
                disabled={leaving}
                aria-label={`${house.name} — ${house.description}`}
                title={house.name}
              >
                {loaded[house.id] ? (
                  <img
                    src={house.image}
                    alt=""
                    draggable={false}
                  />
                ) : (
                  <span className={styles.fallbackHouse}>
                    <span aria-hidden="true">⌂</span>
                    <strong>{house.name.toUpperCase()}</strong>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
