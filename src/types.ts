export type Category =
  | "Utilería"
  | "Mobiliario"
  | "Vestuario"
  | "Arte"
  | "Exterior"
  | "Oficina";

export type ProductStatus = "Excelente" | "Muy bueno" | "Bueno" | "Delicado";
export type Availability = "Disponible" | "Consultar" | "Reservado";
export type ReservationStatus =
  | "request_sent"
  | "payment_pending"
  | "confirmed"
  | "ready_for_pickup"
  | "active"
  | "returned"
  | "cancelled"
  | "pending";

export interface ProductVisual {
  tone: "brass" | "green" | "red" | "blue" | "paper" | "copper";
  sigil: string;
}

export interface Product {
  id: string;
  name: string;
  images: string[];
  thumbnailImages?: string[];
  detailImages?: string[];
  category: Category;
  tags: string[];
  rentalPricePerWeek: number;
  description: string;
  curiosities: string;
  status: ProductStatus;
  measurements: string;
  material: string;
  color: string;
  eraStyle: string;
  availability: Availability;
  estimatedValue: number;
  guaranteePercentage: number;
  minimumDeposit: number;
  featuredScore: number;
  stock: number;
  internalNotes?: string;
  visual: ProductVisual;
}

export interface CuratedCollection {
  id: string;
  title: string;
  description: string;
  productIds: string[];
  coverProductId: string;
  published: boolean;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SelectionItem {
  productId: string;
  quantity: number;
  rentalDays: number;
  startDate?: string;
  endDate?: string;
}

export interface PricingBreakdown {
  rentalSubtotal: number;
  rentalDiscount: number;
  rentalTotal: number;
  guaranteeAmount: number;
  reserveDeposit: number;
  totalEstimated: number;
}

export interface ReservationRange {
  id: string;
  bookingId?: string;
  productId: string;
  quantity?: number;
  rentalDays?: number;
  startDate: string;
  endDate: string;
  source: "firebase";
  status?: ReservationStatus;
  note?: string;
  customerName?: string;
  customerEmail?: string;
  createdByUid?: string;
  paymentAlias?: string;
  pickupOption?: "reservation_day" | "previous_day_requested";
  reserveDeposit?: number;
  guaranteeAmount?: number;
  totalEstimated?: number;
  holdExpiresAt?: string;
  createdAt?: unknown;
}

export interface BookingItem {
  productId: string;
  productName: string;
  quantity: number;
  rentalDays: number;
  startDate: string;
  endDate: string;
  rentalSubtotal: number;
  rentalDiscount: number;
  rentalTotal: number;
  guaranteeAmount: number;
  reserveDeposit: number;
  totalEstimated: number;
}

export interface Booking {
  id: string;
  code: string;
  items: BookingItem[];
  status: ReservationStatus;
  customerName: string;
  customerEmail: string;
  createdByUid: string;
  paymentAlias: string;
  pickupOption: "reservation_day" | "previous_day_requested";
  projectName?: string;
  note?: string;
  reserveDeposit: number;
  guaranteeAmount: number;
  rentalTotal: number;
  totalEstimated: number;
  holdExpiresAt?: string;
  holdExpired?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string;
}
