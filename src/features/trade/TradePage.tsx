
'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {createBrowserClient} from '@supabase/ssr';
import {formatDate} from '@/config/site';

const db = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type GiftType = {name: string; rarity: string} | null;
type Gift = {
  id: string;
  code: string;
  source: string | null;
  created_at: string;
  gift_types: GiftType;
};
type Listing = {
  id: string;
  owner_id: string;
  wanted_description: string;
  status: string;
  created_at: string;
};
type Offer = {
  id: string;
  listing_id: string;
  offered_by: string;
  status: string;
  created_at: string;
};
type ListingItem = {
  listing_id: string;
  gift_item_id: string;
  gift_name: string;
  gift_rarity: string;
};
type OfferItem = {
  offer_id: string;
  gift_item_id: string;
  gift_name: string;
  gift_rarity: string;
};

const RARITY: Record<string, string> = {
  normal: 'Thường',
  rare: 'Rare',
  ssr: 'SSR',
  secret: 'Secret',
};
const rarityLabel = (r?: string | null) =>
  (r && RARITY[r]) || 'Thường';

const SOURCE: Record<string, string> = {
  spin: 'QUAY',
  trade: 'TRADE',
  gift: 'TẶNG',
  admin: 'BST',
};
const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export default function Trade() {
  const [uid, setUid] = useState('');
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [listingItems, setListingItems] = useState<ListingItem[]>([]);
  const [offerItems, setOfferItems] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const [subtab, setSubtab] =
    useState<'inventory' | 'market'>('inventory');
  const [mode, setMode] =
    useState<'trade' | 'gift'>('trade');
  const [postGift, setPostGift] = useState('');
  const [intro, setIntro] = useState('');
  const [view, setView] =
    useState<'open' | 'completed'>('open');
  const [exchangeDate, setExchangeDate] = useState('');
  const [offerSelected, setOfferSelected] =
    useState<Record<string, string[]>>({});

  async function load() {
    setLoading(true);
    setLoadError('');

    const {
      data: {user},
      error: authError,
    } = await db.auth.getUser();

    setUid(user?.id || '');

    if (authError || !user) {
      setGifts([]);
      setListings([]);
      setOffers([]);
      setListingItems([]);
      setOfferItems([]);
      setOfferSelected({});
      setLoading(false);
      return;
    }

    const [a, b, c, d, e] = await Promise.all([
      db.from('gift_items')
        .select(
          'id,code,source,created_at,gift_types(name,rarity)'
        )
        .eq('owner_id', user.id)
        .order('created_at', {ascending: false})
        .limit(200),

      db.from('trade_listings')
        .select(
          'id,owner_id,wanted_description,status,created_at'
        )
        .order('created_at', {ascending: false})
        .limit(100),

      db.from('trade_offers')
        .select(
          'id,listing_id,offered_by,status,created_at'
        )
        .order('created_at', {ascending: false})
        .limit(200),

      db.rpc('trade_public_listing_catalog'),
      db.rpc('trade_visible_offer_catalog'),
    ]);

    setGifts((a.data || []) as unknown as Gift[]);
    setListings((b.data || []) as Listing[]);
    setOffers((c.data || []) as Offer[]);
    setListingItems((d.data || []) as ListingItem[]);
    setOfferItems((e.data || []) as OfferItem[]);

    setLoadError(
      [a.error, b.error, c.error, d.error, e.error]
        .filter(Boolean)
        .map((x) => x!.message)
        .join(' · ')
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function call(
    fn: string,
    args: Record<string, unknown>
  ) {
    if (busy || loading || loadError) return;

    setBusy(true);
    setMessage('');

    try {
      const {error} = await db.rpc(fn, args);
      setMessage(
        error ? error.message : 'Đã cập nhật thành công'
      );

      if (!error) {
        setIntro('');
        setOfferSelected({});
        await load();
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'Không thể cập nhật Trade.'
      );
    } finally {
      setBusy(false);
    }
  }

  const toggle = (ids: string[], id: string) =>
    ids.includes(id)
      ? ids.filter((x) => x !== id)
      : [...ids, id];

  const openListingIds = new Set(
    listings
      .filter((l) => l.status === 'open')
      .map((l) => l.id)
  );

  const myPendingOfferIds = new Set(
    offers
      .filter(
        (o) =>
          o.status === 'pending' &&
          o.offered_by === uid &&
          openListingIds.has(o.listing_id)
      )
      .map((o) => o.id)
  );

  const reserved = new Set<string>([
    ...listingItems
      .filter((x) => openListingIds.has(x.listing_id))
      .map((x) => x.gift_item_id),
    ...offerItems
      .filter((x) => myPendingOfferIds.has(x.offer_id))
      .map((x) => x.gift_item_id),
  ]);

  const available = gifts.filter(
    (g) => !reserved.has(g.id)
  );

  const postGiftId =
    available.find((g) => g.id === postGift)?.id ??
    available[0]?.id ??
    '';

  const myListingIds = new Set(
    listings
      .filter((l) => l.owner_id === uid)
      .map((l) => l.id)
  );

  const statusText: Record<string, string> = {
    accepted: 'đã được đồng ý',
    rejected: 'đã bị từ chối',
    withdrawn: 'đã được rút lại',
  };

  const notices = [
    ...offers
      .filter(
        (o) =>
          myListingIds.has(o.listing_id) &&
          o.status === 'pending'
      )
      .map((o) => ({
        id: 'in-' + o.id,
        date: o.created_at,
        text:
          'Bạn có offer mới cho bài TRADE #' +
          shortId(o.listing_id) +
          '.',
      })),
    ...offers
      .filter(
        (o) =>
          o.offered_by === uid &&
          o.status !== 'pending'
      )
      .map((o) => ({
        id: 'out-' + o.id,
        date: o.created_at,
        text:
          'Offer của bạn cho bài TRADE #' +
          shortId(o.listing_id) +
          ' ' +
          (statusText[o.status] || o.status) +
          '.',
      })),
  ].sort(
    (a, b) =>
      new Date(b.date).getTime() -
      new Date(a.date).getTime()
  );

  const groups = Object.values(
    gifts.reduce<
      Record<
        string,
        {
          name: string;
          rarity: string;
          items: Gift[];
        }
      >
    >((acc, g) => {
      const name = g.gift_types?.name || 'Quà';
      const rarity = rarityLabel(g.gift_types?.rarity);
      const key = name + '::' + rarity;

      (acc[key] ??= {
        name,
        rarity,
        items: [],
      }).items.push(g);

      return acc;
    }, {})
  ).sort((a, b) =>
    a.name.localeCompare(b.name, 'vi')
  );

  const visibleListings = listings.filter((l) => {
    if (l.status !== view) return false;
    if (!exchangeDate) return true;

    return offers.some(
      (o) =>
        o.listing_id === l.id &&
        String(o.created_at || '').slice(0, 10) ===
          exchangeDate
    );
  });

  const giftNames = (items: ListingItem[]) =>
    items
      .map((x) => x.gift_name || 'Quà')
      .join(' + ');

  if (loading) {
    return (
      <main id="app">
        <section className="panel">
          <p className="muted">
            Đang tải sàn Trade...
          </p>
        </section>
      </main>
    );
  }

  if (!uid) {
    return (
      <main id="app">
        <section className="panel">
          <h2>SÀN TRADE GIFT</h2>
          <p className="muted">
            Đăng nhập để xem các bài Trade,
            đăng quà và gửi Offer.
          </p>
          <p>
            <Link href="/login">ĐĂNG NHẬP</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main id="app">
      <div className="subtabs">
        <button
          type="button"
          className={
            subtab === 'inventory'
              ? 'selected'
              : undefined
          }
          onClick={() => setSubtab('inventory')}
        >
          QUÀ CỦA TÔI & LỊCH SỬ TRADE
        </button>
        <button
          type="button"
          className={
            subtab === 'market'
              ? 'selected'
              : undefined
          }
          onClick={() => setSubtab('market')}
        >
          SÀN TRADE GIFT
        </button>
      </div>

      {loadError && (
        <p role="alert" className="error">
          Không tải được dữ liệu Trade: {loadError}
        </p>
      )}

      {message && (
        <p role="status" className="note">
          {message}
        </p>
      )}

      {subtab === 'inventory' && (
        <>
          <section className="panel">
            <h2>THÔNG BÁO TRADE & TẶNG QUÀ</h2>

            {notices.map((n) => (
              <div className="note" key={n.id}>
                🎁 {n.text} · {formatDate(n.date)}
              </div>
            ))}

            {notices.length === 0 && (
              <p className="muted">
                Chưa có thông báo.
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Inventory của bạn</h2>

            {groups.map((g) => (
              <details
                className="inventory-group"
                key={g.name + g.rarity}
              >
                <summary>
                  <span className="inventory-group-icon">
                    🎀
                  </span>

                  <span className="inventory-group-main">
                    <strong>{g.name}</strong>
                    <small>{g.rarity}</small>
                  </span>

                  <span className="inventory-group-count">
                    {g.items.length} món
                  </span>

                  <span className="inventory-group-chevron">
                    ⌄
                  </span>
                </summary>

                <div className="inventory-group-items">
                  {g.items.map((x) => {
                    const src =
                      SOURCE[x.source || ''] || 'QUAY';

                    return (
                      <div
                        className="inventory-item"
                        key={x.id}
                      >
                        <div>
                          <span
                            className={
                              'inventory-origin inventory-origin-' +
                              src.toLowerCase()
                            }
                          >
                            {src}
                          </span>{' '}
                          <span className="inventory-item-code">
                            {x.code}
                          </span>
                          <br />
                          <small>
                            {formatDate(x.created_at)}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}

            {groups.length === 0 && (
              <p className="muted">
                Bạn chưa có quà.
              </p>
            )}
          </section>
        </>
      )}

      {subtab === 'market' && (
        <>
          <section className="panel">
            <h2>TRADE HOẶC TẶNG QUÀ</h2>

            <div className="subtabs">
              <button
                type="button"
                className={
                  mode === 'trade'
                    ? 'selected'
                    : undefined
                }
                onClick={() => setMode('trade')}
              >
                TRADE
              </button>

              <button
                type="button"
                className={
                  mode === 'gift'
                    ? 'selected'
                    : undefined
                }
                onClick={() => setMode('gift')}
              >
                TẶNG
              </button>
            </div>

            {mode === 'gift' && (
              <p className="muted">
                Tính năng tặng quà cho người khác
                đang được hoàn thiện, hiện chưa dùng được.
              </p>
            )}

            {mode === 'trade' && (
              <div>
                <p className="muted">
                  Chỉ chủ bài đăng được xóa bài đang mở.
                </p>

                <select
                  id="postGift"
                  aria-label="Chọn quà muốn đăng"
                  value={postGiftId}
                  onChange={(e) =>
                    setPostGift(e.target.value)
                  }
                >
                  {available.map((g) => (
                    <option key={g.id} value={g.id}>
                      {(g.gift_types?.name || 'Quà') +
                        ' · ' +
                        g.code}
                    </option>
                  ))}
                </select>

                <label htmlFor="tradeIntro">
                  TỰ GIỚI THIỆU / QUÀ ĐANG TÌM
                  (KHÔNG BẮT BUỘC)
                </label>

                <textarea
                  id="tradeIntro"
                  rows={7}
                  maxLength={3000}
                  value={intro}
                  onChange={(e) =>
                    setIntro(e.target.value)
                  }
                  placeholder="Bạn đang tìm món quà nào? Hoặc gửi vài lời đến KANDEE..."
                />

                <p>
                  <button
                    disabled={
                      busy ||
                      !!loadError ||
                      !postGiftId
                    }
                    onClick={() =>
                      call('trade_create', {
                        items: [postGiftId],
                        description: intro,
                      })
                    }
                  >
                    Đăng lên sàn
                  </button>
                </p>
              </div>
            )}
          </section>

          <section className="panel trade-market">
            <div className="trade-market-head">
              <div>
                <span className="trade-eyebrow">
                  THE EXCHANGE CLUB
                </span>
                <h2>SÀN TRADE GIFT</h2>
              </div>
            </div>

            <p className="muted">
              Chọn trạng thái để xem các bài đang
              nhận đề nghị hoặc đã trao đổi thành công.
            </p>

            <div className="exchange-switch">
              <button
                type="button"
                className={
                  view === 'open'
                    ? 'selected'
                    : undefined
                }
                onClick={() => setView('open')}
              >
                ĐANG OFFER
              </button>

              <button
                type="button"
                className={
                  view === 'completed'
                    ? 'selected'
                    : undefined
                }
                onClick={() => setView('completed')}
              >
                ĐÃ TRADE
              </button>
            </div>

            <div className="exchange-date-filter">
              <label htmlFor="exchangeOfferDate">
                LỌC THEO NGÀY OFFER
              </label>

              <input
                type="date"
                id="exchangeOfferDate"
                aria-label="Lọc bài Trade theo ngày gửi offer"
                value={exchangeDate}
                onChange={(e) =>
                  setExchangeDate(e.target.value)
                }
              />

              <button
                type="button"
                className="secondary"
                onClick={() => setExchangeDate('')}
              >
                Tất cả ngày
              </button>
            </div>

            {visibleListings.map((l) => {
              const isOwner = l.owner_id === uid;
              const done = l.status === 'completed';

              const items = listingItems.filter(
                (x) => x.listing_id === l.id
              );

              const listingOffers = offers.filter(
                (o) => o.listing_id === l.id
              );

              const pending = listingOffers.filter(
                (o) => o.status === 'pending'
              );

              const first = items[0];
              const picked =
                offerSelected[l.id] || [];

              return (
                <div
                  className="trade-card exchange-fold"
                  key={l.id}
                >
                  <details className="exchange-details">
                    <summary className="exchange-summary">
                      <span className="exchange-summary-main">
                        <span className="trade-eyebrow">
                          {done
                            ? 'QUÀ ĐÃ ĐỀ NGHỊ TRADE'
                            : 'QUÀ ĐANG ĐỀ NGHỊ TRADE'}
                        </span>

                        <strong className="exchange-gift-title">
                          {giftNames(items) ||
                            'Quà riêng tư'}
                        </strong>

                        <span className="exchange-gift-caption">
                          {rarityLabel(
                            first?.gift_rarity
                          )}{' '}
                          · TRADE #{shortId(l.id)}
                        </span>
                      </span>

                      <span className="exchange-summary-right">
                        <span
                          className={
                            'trade-status' +
                            (done ? ' done' : '')
                          }
                        >
                          {done
                            ? '✓ Đã Trade'
                            : 'Đang nhận · ' +
                              pending.length +
                              ' đề nghị'}
                        </span>

                        <span
                          className="exchange-chevron"
                          aria-hidden="true"
                        >
                          ⌄
                        </span>
                      </span>
                    </summary>

                    <div className="exchange-detail-body">
                      {l.wanted_description && (
                        <div className="trade-intro">
                          <span className="trade-eyebrow">
                            LỜI NHẮN TỪ NGƯỜI ĐĂNG
                          </span>
                          <p
                            style={{
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {l.wanted_description}
                          </p>
                        </div>
                      )}

                      <div className="trade-meta">
                        {isOwner
                          ? 'Bài của bạn'
                          : 'Bài của thành viên khác'}

                        <span className="trade-meta-divider">
                          {' '}·{' '}
                        </span>

                        {formatDate(l.created_at)}
                      </div>

                      {!done && isOwner && (
                        <p>
                          <button
                            className="secondary"
                            disabled={
                              busy || !!loadError
                            }
                            onClick={() =>
                              call('trade_cancel', {
                                listing: l.id,
                              })
                            }
                          >
                            Xóa bài Trade
                          </button>
                        </p>
                      )}

                      {!done && !isOwner && (
                        <div className="trade-offer-box">
                          <b>
                            Chọn quà đề nghị đổi lấy{' '}
                            {giftNames(items) ||
                              'quà này'}
                          </b>

                          <p className="muted">
                            Có thể chọn nhiều quà để
                            đổi 1 quà. Nếu được chấp
                            nhận, tất cả quà đã chọn
                            sẽ chuyển cho người đăng.
                          </p>

                          <div className="trade-choice-list">
                            {available.map((g) => (
                              <label
                                className="trade-choice"
                                key={g.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={picked.includes(
                                    g.id
                                  )}
                                  onChange={() =>
                                    setOfferSelected({
                                      ...offerSelected,
                                      [l.id]: toggle(
                                        picked,
                                        g.id
                                      ),
                                    })
                                  }
                                />

                                <span>
                                  <b>
                                    {g.gift_types
                                      ?.name || 'Quà'}
                                  </b>

                                  <small>
                                    {rarityLabel(
                                      g.gift_types
                                        ?.rarity
                                    )}{' '}
                                    · {g.code}
                                  </small>
                                </span>
                              </label>
                            ))}

                            {available.length === 0 && (
                              <span className="muted">
                                Không có quà khả dụng.
                              </span>
                            )}
                          </div>

                          <p>
                            <button
                              disabled={
                                busy ||
                                !!loadError ||
                                picked.length === 0 ||
                                picked.length > 20
                              }
                              onClick={() =>
                                call('trade_offer', {
                                  listing: l.id,
                                  items: picked,
                                })
                              }
                            >
                              Đề nghị Trade
                            </button>
                          </p>
                        </div>
                      )}

                      {listingOffers.length > 0 && (
                        <h3>
                          Danh sách Offer (
                          {listingOffers.length})
                        </h3>
                      )}

                      {listingOffers.map((o) => {
                        const gs = offerItems.filter(
                          (x) => x.offer_id === o.id
                        );

                        return (
                          <div
                            className="trade-offer-row"
                            key={o.id}
                          >
                            <span>
                              <b>
                                👤 Offer #
                                {shortId(o.id)}
                              </b>{' '}
                              đề nghị{' '}
                              <b>{gs.length} quà</b>

                              <div className="trade-offer-gifts">
                                {gs.map((g) => (
                                  <span
                                    className="rarity-pill"
                                    key={g.gift_item_id}
                                  >
                                    🎀{' '}
                                    {g.gift_name ||
                                      'Quà'}{' '}
                                    ·{' '}
                                    {rarityLabel(
                                      g.gift_rarity
                                    )}
                                  </span>
                                ))}
                              </div>

                              <small>
                                Gửi:{' '}
                                {formatDate(
                                  o.created_at
                                )}
                              </small>

                              <br />

                              <small>
                                Trạng thái:{' '}
                                {o.status === 'accepted'
                                  ? 'Đã đồng ý'
                                  : o.status === 'rejected'
                                  ? 'Đã từ chối'
                                  : o.status === 'withdrawn'
                                  ? 'Đã rút lại'
                                  : 'Chờ quyết định'}
                              </small>
                            </span>

                            {isOwner &&
                              !done &&
                              o.status ===
                                'pending' && (
                                <>
                                  <button
                                    disabled={
                                      busy ||
                                      !!loadError
                                    }
                                    onClick={() =>
                                      call(
                                        'trade_decide',
                                        {
                                          offer: o.id,
                                          accept: true,
                                        }
                                      )
                                    }
                                  >
                                    Đồng ý
                                  </button>

                                  <button
                                    className="secondary"
                                    disabled={
                                      busy ||
                                      !!loadError
                                    }
                                    onClick={() =>
                                      call(
                                        'trade_decide',
                                        {
                                          offer: o.id,
                                          accept: false,
                                        }
                                      )
                                    }
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              );
            })}

            {visibleListings.length === 0 && (
              <p className="muted">
                {view === 'open'
                  ? 'Chưa có bài đang nhận Offer.'
                  : 'Chưa có bài đã Trade.'}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
