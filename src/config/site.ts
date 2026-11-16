
/** Cấu hình thương hiệu và menu BINGSU TEAM V40. */

export const site = {
  title: 'BST - All For Trang Phap',
  brand: 'BINGSU TEAM',
  subtitle: 'Retrouvailles0125 x nlessliberty',

  nav: [
    { label: 'THỐNG KÊ TỔNG QUAN', href: '/home' },
    { label: 'THEO DÕI DONATE', href: '/tracking' },
    { label: 'NGÔI SAO MAY MẮN', href: '/star' },
    { label: 'SÀN TRADE GIFT', href: '/trade' },
    { label: 'YÊU THƯƠNG GỬI TRANG', href: '/love' },
    { label: 'TÀI KHOẢN CỦA TÔI', href: '/account' },
    { label: 'BINGSU TEAM', href: '/admin' },
  ],
} as const;

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('vi-VN').format(amount) + ' VND';

export const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
