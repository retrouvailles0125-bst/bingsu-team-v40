
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
  const [selected, setSelected] = useState<HouseId | null>(
    null
  );

  const [loaded, setLoaded] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    let active = true;

    const assets = [
      {
        id: 'background',
        src: '/universe/background.png',
      },
      ...houses.map((house) => ({
        id: house.id,
        src: house.image,
      })),
    ];

    assets.forEach((asset) => {
      const img = new window.Image();

      img.onload = () => {
        if (!active) return;

        setLoaded((previous) => ({
          ...previous,
          [asset.id]: true,
        }));
      };

      img.onerror = () => {
        if (!active) return;

        setLoaded((previous) => ({
          ...previous,
          [asset.id]: false,
        }));
      };

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
          {/* Fallback background */}
          <div
            className={styles.fallbackMap}
            aria-hidden="true"
          >
            <div className={styles.fallbackLogo}>
              BST
              <br />
              UNIVERSE

              <small>ALL FOR TRANGPHAP</small>
            </div>

            <div className={styles.roadOne} />
            <div className={styles.roadTwo} />
            <div className={styles.roadThree} />
          </div>

          {/* Main artwork */}
          {loaded.background && (
            <img
              className={styles.background}
              src="/universe/background.png"
              alt="Bản đồ BST Universe với các con đường màu hồng"
              draggable={false}
            />
          )}

          {/* Interactive buildings */}
          {houses.map((house) => {
            const houseClass = styles[house.id];

            const isSelected = selected === house.id;

            return (
              <button
                type="button"
                key={house.id}
                className={[
                  styles.house,
                  houseClass,
                  isSelected ? styles.selected : '',
                ].filter(Boolean).join(' ')}
                onClick={() => go(house.href, house.id)}
                disabled={leaving}
                aria-label={
                  `${house.name} — ${house.description}`
                }
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
                    <strong>
                      {house.name.toUpperCase()}
                    </strong>
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
