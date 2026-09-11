import type {
  BookingStatusValue,
  EquipmentStatusValue,
  JobStatusValue,
  OccurrenceStatusValue,
  PaymentProviderValue,
  PaymentPurposeValue,
  PaymentStatusValue,
  RentalStatusValue,
  RoomStatusValue,
  StreamStatusValue,
} from './domain.js';

/**
 * Dashboard contracts. Every timestamp is an ISO-8601 UTC string; every amount
 * is integer KES cents.
 */

// ---------------------------------------------------------------------------
// User (customer) dashboard — GET /me/dashboard
// ---------------------------------------------------------------------------

export interface DashboardBooking {
  id: string;
  reference: string;
  status: BookingStatusValue;
  startsAt: string;
  endsAt: string;
  studioName: string;
  roomName: string;
  serviceName: string;
  totalCents: number;
  /** Sum of SUCCESSFUL payments linked to this booking. */
  paidCents: number;
}

export interface DashboardRental {
  id: string;
  reference: string;
  status: RentalStatusValue;
  startsAt: string;
  endsAt: string;
  totalCents: number;
  paidCents: number;
  /** Checked out and past its return time, or already flagged OVERDUE. */
  isOverdue: boolean;
  items: string[];
}

export interface DashboardPayment {
  id: string;
  reference: string;
  status: PaymentStatusValue;
  provider: PaymentProviderValue;
  purpose: PaymentPurposeValue;
  amountCents: number;
  receiptNumber: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface DashboardNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface DashboardDeliverable {
  id: string;
  title: string;
  bookingReference: string;
  dueAt: string | null;
  deliveredAt: string | null;
}

export interface CustomerDashboard {
  generatedAt: string;
  timezone: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    emailVerified: boolean;
    memberSince: string;
  };
  stats: {
    upcomingBookings: number;
    activeRentals: number;
    balanceDueCents: number;
    totalPaidCents: number;
    unreadNotifications: number;
  };
  upcomingBookings: DashboardBooking[];
  recentBookings: DashboardBooking[];
  activeRentals: DashboardRental[];
  recentPayments: DashboardPayment[];
  notifications: DashboardNotification[];
  deliverables: DashboardDeliverable[];
}

// ---------------------------------------------------------------------------
// Admin / operations dashboard — GET /admin/dashboard
// ---------------------------------------------------------------------------

export interface OnAirOccurrence {
  id: string;
  showName: string;
  title: string | null;
  roomName: string | null;
  status: OccurrenceStatusValue;
  startsAt: string;
  endsAt: string;
  wentLiveAt: string | null;
}

export interface LiveStream {
  id: string;
  title: string;
  status: StreamStatusValue;
  startedAt: string | null;
  platforms: Array<{ platform: string; status: StreamStatusValue; watchUrl: string | null }>;
}

export interface OnAirSection {
  /** Occurrences an operator has actually put on air. */
  live: OnAirOccurrence[];
  /** Airings whose window covers now but that nobody has started. */
  scheduledNow: OnAirOccurrence[];
  next: OnAirOccurrence[];
  /** Present only with `stream:read`. */
  liveStreams?: LiveStream[];
}

export interface AdminBookingRow {
  id: string;
  reference: string;
  status: BookingStatusValue;
  startsAt: string;
  endsAt: string;
  customerName: string;
  roomName: string;
  serviceName: string;
  totalCents: number;
}

export interface BookingsSection {
  todayCount: number;
  today: AdminBookingRow[];
  todayByStatus: Partial<Record<BookingStatusValue, number>>;
  pendingApprovalCount: number;
  pendingApproval: AdminBookingRow[];
  pendingPaymentCount: number;
  next7DaysCount: number;
}

export interface RoomUtilisation {
  roomId: string;
  roomName: string;
  studioName: string;
  status: RoomStatusValue;
  /** Minutes the studio is open today; 0 when closed. */
  openMinutes: number;
  /** Booked minutes clipped to today's opening hours. */
  bookedMinutes: number;
  /** bookedMinutes / openMinutes in [0, 1]; null when closed today. */
  utilisation: number | null;
  bookingsToday: number;
}

export interface RoomsSection {
  rooms: RoomUtilisation[];
}

export interface AdminRentalRow {
  id: string;
  reference: string;
  status: RentalStatusValue;
  customerName: string;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  totalCents: number;
}

export interface RentalsSection {
  pendingApprovalCount: number;
  checkedOutCount: number;
  overdueCount: number;
  overdue: AdminRentalRow[];
  dueBackToday: AdminRentalRow[];
}

export interface EquipmentSection {
  total: number;
  byStatus: Record<EquipmentStatusValue, number>;
  /** Units in POOR or DAMAGED condition that are not retired. */
  needsAttention: number;
  openMaintenance: number;
}

export interface RevenueDay {
  /** `YYYY-MM-DD` in the studio timezone. */
  date: string;
  totalCents: number;
  count: number;
}

export interface RevenueSection {
  currency: 'KES';
  todayCents: number;
  last7DaysCents: number;
  monthToDateCents: number;
  pendingCount: number;
  pendingCents: number;
  failedTodayCount: number;
  pendingRefundsCount: number;
  /** One entry per day, oldest first, including days with no revenue. */
  daily: RevenueDay[];
}

export interface UsersSection {
  total: number;
  customers: number;
  staff: number;
  newLast7Days: number;
  pendingVerification: number;
  inactive: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface SystemSection {
  outbox: { queued: number; failed: number };
  jobs: Array<{
    name: string;
    status: JobStatusValue;
    lastRunAt: string | null;
    lastEndedAt: string | null;
    lastError: string | null;
    runCount: number;
  }>;
}

export interface AdminDashboardSections {
  onAir?: OnAirSection;
  bookings?: BookingsSection;
  rooms?: RoomsSection;
  rentals?: RentalsSection;
  equipment?: EquipmentSection;
  revenue?: RevenueSection;
  users?: UsersSection;
  activity?: { entries: ActivityEntry[] };
  system?: SystemSection;
}

export interface AdminDashboard {
  generatedAt: string;
  timezone: string;
  /** `YYYY-MM-DD` in the studio timezone. */
  today: string;
  /** Only the sections the caller's permissions allow are present. */
  sections: AdminDashboardSections;
}
