import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ImagePlus,
  Layers3,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  PackageCheck,
  Plus,
  Save,
  Search,
  Trash2,
  UploadCloud,
  UserRound,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useAuth } from "../context/AuthContext";
import { useAvailability } from "../context/AvailabilityContext";
import { useCatalog } from "../context/CatalogContext";
import { COLLECTIONS_CONFIG_PRODUCT_ID, useCollections } from "../context/CollectionsContext";
import { categories } from "../data/products";
import { firebaseEnabled, getFirebaseApp, getFirebaseDb } from "../services/firebase";
import type {
  Availability,
  Booking,
  CuratedCollection,
  Product,
  ProductStatus,
  ProductVisual,
  ReservationStatus,
  UserProfile,
} from "../types";
import {
  addDaysIso,
  formatDateRange,
  parseIsoDate,
  rangesOverlap,
  todayIso,
  toIsoDate,
} from "../utils/dates";
import { formatCurrency } from "../utils/format";
import {
  getReservationStatusLabel,
  isReservationHoldExpired,
} from "../utils/reservations";

type AdminTab = "overview" | "bookings" | "calendar" | "customers" | "catalog" | "collections";

const activeStatuses: ReservationStatus[] = [
  "request_sent",
  "payment_pending",
  "confirmed",
  "ready_for_pickup",
  "active",
  "pending",
];
const reservationStatusOptions: ReservationStatus[] = [
  "payment_pending",
  "confirmed",
  "ready_for_pickup",
  "active",
  "returned",
  "cancelled",
];
const productStatusOptions: ProductStatus[] = ["Excelente", "Muy bueno", "Bueno", "Delicado"];
const availabilityOptions: Availability[] = ["Disponible", "Consultar", "Reservado"];
const toneOptions: ProductVisual["tone"][] = ["brass", "green", "red", "blue", "paper", "copper"];
const adminWeekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function isActiveBooking(booking: Booking) {
  return activeStatuses.includes(booking.status) && !isExpiredHold(booking);
}

function isExpiredHold(booking: Booking) {
  return booking.holdExpired ?? isReservationHoldExpired(booking);
}

function bookingStart(booking: Booking) {
  return booking.items.reduce(
    (earliest, item) => (!earliest || item.startDate < earliest ? item.startDate : earliest),
    "",
  );
}

function bookingEnd(booking: Booking) {
  return booking.items.reduce(
    (latest, item) => (!latest || item.endDate > latest ? item.endDate : latest),
    "",
  );
}

function customerWhatsappUrl(phone: string, booking: Booking) {
  const number = phone.replace(/\D/g, "");
  const text = encodeURIComponent(
    `Hola ${booking.customerName || ""}, te escribimos de Totem Rental por tu pedido ${booking.code}.`,
  );
  return `https://wa.me/${number}?text=${text}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildMonthDays(month: Date) {
  const first = monthStart(month);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      iso: toIsoDate(date),
      inMonth: date.getMonth() === first.getMonth(),
    };
  });
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatHold(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function AdminOverview({
  bookings,
  products,
  profiles,
  onOpenTab,
}: {
  bookings: Booking[];
  products: Product[];
  profiles: UserProfile[];
  onOpenTab: (tab: AdminTab) => void;
}) {
  const today = todayIso();
  const nextWeek = addDaysIso(today, 7);
  const activeBookings = bookings.filter(isActiveBooking);
  const pendingPayments = activeBookings.filter((booking) => booking.status === "payment_pending");
  const expiredHolds = bookings.filter(isExpiredHold);
  const upcomingPickups = activeBookings.filter((booking) => {
    const start = bookingStart(booking);
    return start >= today && start <= nextWeek;
  });
  const nextBookings = activeBookings
    .filter((booking) => bookingEnd(booking) >= today)
    .sort((a, b) => bookingStart(a).localeCompare(bookingStart(b)))
    .slice(0, 5);

  return (
    <div className="admin-overview">
      <div className="admin-metrics" aria-label="Resumen operativo">
        <article>
          <span>Señas pendientes</span>
          <strong>{pendingPayments.length}</strong>
          <p>{expiredHolds.length} retenciones vencidas y liberadas</p>
        </article>
        <article>
          <span>Próximos 7 días</span>
          <strong>{upcomingPickups.length}</strong>
          <p>retiros por preparar</p>
        </article>
        <article>
          <span>Clientes</span>
          <strong>{profiles.length}</strong>
          <p>perfiles registrados</p>
        </article>
        <article>
          <span>Catálogo</span>
          <strong>{products.length}</strong>
          <p>{products.filter((product) => product.availability === "Disponible").length} disponibles</p>
        </article>
      </div>

      <section className="admin-focus-card">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">Próximos movimientos</p>
            <h2>Lo que requiere atención</h2>
          </div>
          <button type="button" onClick={() => onOpenTab("bookings")}>Ver todas las reservas</button>
        </div>
        {nextBookings.length === 0 ? (
          <p className="admin-empty-reservations">No hay retiros o alquileres próximos.</p>
        ) : (
          <div className="admin-upcoming-list">
            {nextBookings.map((booking) => (
              <button key={booking.id} type="button" onClick={() => onOpenTab("bookings")}>
                <span className={`admin-status-dot status-${booking.status}`} />
                <strong>{booking.code}</strong>
                <span>{booking.customerName}</span>
                <span>{formatDateRange(bookingStart(booking), bookingEnd(booking))}</span>
                <em>{getReservationStatusLabel(booking.status)}</em>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BookingAdminCard({
  booking,
  profile,
  onMessage,
}: {
  booking: Booking;
  profile?: UserProfile;
  onMessage: (message: string) => void;
}) {
  const db = getFirebaseDb();
  const [status, setStatus] = useState<ReservationStatus>(booking.status);
  const [note, setNote] = useState(booking.note ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(booking.status);
    setNote(booking.note ?? "");
  }, [booking.note, booking.status]);

  const saveBooking = async () => {
    if (!db) return;

    try {
      setSaving(true);
      const rangesSnapshot = await getDocs(
        query(collection(db, "reservationRanges"), where("bookingId", "==", booking.id)),
      );
      const batch = writeBatch(db);
      batch.update(doc(db, "bookings", booking.id), {
        status,
        note: note.trim(),
        updatedAt: serverTimestamp(),
      });
      rangesSnapshot.docs.forEach((rangeDoc) => {
        batch.update(rangeDoc.ref, { status });
      });
      if (status === "confirmed" && booking.status !== "confirmed") {
        const itemLines = booking.items
          .map((item) => `${item.quantity}x ${item.productName} - ${formatDateRange(item.startDate, item.endDate)}`)
          .join("\n");
        batch.set(doc(db, "mail", `booking-confirmed-${booking.id}`), {
          to: [booking.customerEmail],
          message: {
            subject: `Tu pedido ${booking.code} está confirmado`,
            text: [
              `Hola ${booking.customerName || ""},`,
              "",
              `Confirmamos el pago de la seña de tu pedido ${booking.code}.`,
              "Tus fechas ya quedaron reservadas.",
              "",
              itemLines,
              "",
              "Te avisaremos cuando tu pedido esté listo para retirar.",
              "Retiro: Mendoza 2364, CABA, de 9 a 13 hs, coordinado previamente por WhatsApp.",
              "",
              "Totem Rental",
            ].join("\n"),
          },
          bookingId: booking.id,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      onMessage(`Pedido ${booking.code} actualizado.`);
    } catch (error) {
      console.error(error);
      onMessage("No se pudo actualizar el pedido. Revisá la conexión y los permisos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="admin-booking-card">
      <header>
        <div>
          <span className="booking-code">{booking.code}</span>
          <h3>{booking.customerName || booking.customerEmail}</h3>
          <p>{booking.projectName || "Sin nombre de proyecto"} · {formatDateRange(bookingStart(booking), bookingEnd(booking))}</p>
        </div>
        <span className={`booking-status status-${booking.status}`}>
          {getReservationStatusLabel(booking.status)}
        </span>
      </header>

      <div className="admin-booking-body">
        <div className="admin-booking-items">
          {booking.items.map((item) => (
            <div key={`${booking.id}-${item.productId}`}>
              <span><strong>{item.quantity}×</strong> {item.productName}</span>
              <span>{formatDateRange(item.startDate, item.endDate)}</span>
              <em>{formatCurrency(item.rentalTotal)}</em>
            </div>
          ))}
        </div>

        <aside className="admin-customer-summary">
          <strong>Contacto</strong>
          <span>{booking.customerEmail}</span>
          {profile?.dni && <span>DNI {profile.dni}</span>}
          {profile?.phone && <span>{profile.phone}</span>}
          <div>
            <a href={`mailto:${booking.customerEmail}`} aria-label="Enviar email"><Mail size={16} /></a>
            {profile?.phone && (
              <a
                href={customerWhatsappUrl(profile.phone, booking)}
                target="_blank"
                rel="noreferrer"
                aria-label="Escribir por WhatsApp"
              >
                <MessageCircle size={16} />
              </a>
            )}
          </div>
        </aside>
      </div>

      <div className="admin-booking-finance">
        <span>Alquiler <strong>{formatCurrency(booking.rentalTotal)}</strong></span>
        <span>Seña <strong>{formatCurrency(booking.reserveDeposit)}</strong></span>
        <span>Garantía <strong>{formatCurrency(booking.guaranteeAmount)}</strong></span>
        {booking.status === "payment_pending" && booking.holdExpiresAt && (
          <span className={isExpiredHold(booking) ? "is-expired" : ""}>
            <Clock3 size={14} /> Retención hasta {formatHold(booking.holdExpiresAt)}
          </span>
        )}
      </div>

      <div className="admin-booking-controls">
        <label>
          Estado
          <select className="gabinete-input" value={status} onChange={(event) => setStatus(event.target.value as ReservationStatus)}>
            {reservationStatusOptions.map((option) => (
              <option key={option} value={option}>{getReservationStatusLabel(option)}</option>
            ))}
          </select>
        </label>
        <label>
          Nota interna / logística
          <input className="gabinete-input" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <button type="button" className="gabinete-button" onClick={saveBooking} disabled={saving}>
          <Save size={16} />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </article>
  );
}

function AdminBookings({
  bookings,
  profiles,
}: {
  bookings: Booking[];
  profiles: UserProfile[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | ReservationStatus>("active");
  const [message, setMessage] = useState("");
  const profilesByUid = useMemo(
    () => new Map(profiles.map((profile) => [profile.uid, profile])),
    [profiles],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const filteredBookings = bookings
    .filter((booking) => {
      if (statusFilter === "active" && !isActiveBooking(booking)) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && booking.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return [
        booking.code,
        booking.customerName,
        booking.customerEmail,
        booking.projectName,
        ...booking.items.map((item) => `${item.productName} ${item.productId}`),
      ].some((value) => value?.toLocaleLowerCase("es").includes(normalizedSearch));
    })
    .sort((a, b) => {
      const aActive = isActiveBooking(a) ? 0 : 1;
      const bActive = isActiveBooking(b) ? 0 : 1;
      return aActive - bActive || bookingStart(a).localeCompare(bookingStart(b));
    });

  return (
    <section className="admin-bookings-section">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Reservas</p>
          <h2>Seguimiento de pedidos</h2>
          <p>Cada tarjeta reúne cliente, piezas, fechas, seña y estado.</p>
        </div>
      </div>

      <div className="admin-filter-bar">
        <label>
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código, cliente, proyecto u objeto" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
          <option value="active">Activas y en proceso</option>
          <option value="all">Todas</option>
          {reservationStatusOptions.map((status) => (
            <option key={status} value={status}>{getReservationStatusLabel(status)}</option>
          ))}
        </select>
      </div>

      {message && <p className="admin-message"><CheckCircle2 size={16} />{message}</p>}
      {filteredBookings.length === 0 ? (
        <p className="admin-empty-reservations">No hay reservas que coincidan con la búsqueda.</p>
      ) : (
        <div className="admin-booking-list">
          {filteredBookings.map((booking) => (
            <BookingAdminCard
              key={booking.id}
              booking={booking}
              profile={profilesByUid.get(booking.createdByUid)}
              onMessage={setMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AdminCalendar({ bookings }: { bookings: Booking[] }) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(parseIsoDate(todayIso())));
  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const visibleItems = bookings.flatMap((booking) =>
    isActiveBooking(booking)
      ? booking.items.map((item) => ({ booking, item }))
      : [],
  );

  return (
    <section className="admin-reservations parchment-panel">
      <div className="admin-reservations-head">
        <div>
          <p className="eyebrow flex items-center gap-2"><CalendarDays size={15} />Calendario</p>
          <h2>Ocupación y movimientos</h2>
          <p>Reservas activas, retiros y devoluciones en una sola vista.</p>
        </div>
        <div className="calendar-month-bar admin-calendar-nav">
          <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, -1))}><ChevronLeft size={18} /></button>
          <strong>{formatMonth(visibleMonth)}</strong>
          <button type="button" onClick={() => setVisibleMonth((current) => addMonths(current, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="admin-calendar-grid">
        {adminWeekdays.map((day) => <span key={day} className="calendar-weekday">{day}</span>)}
        {days.map(({ iso, inMonth }) => {
          const dayItems = visibleItems.filter(({ item }) =>
            rangesOverlap(iso, iso, item.startDate, item.endDate),
          );
          return (
            <div key={iso} className={`admin-calendar-day ${inMonth ? "" : "is-outside"} ${dayItems.length ? "has-reservations" : ""}`}>
              <span className="admin-calendar-number">{Number(iso.slice(-2))}</span>
              {dayItems.slice(0, 3).map(({ booking, item }) => (
                <span
                  key={`${booking.id}-${item.productId}`}
                  className={`admin-calendar-chip status-${booking.status}`}
                  title={`${booking.code} · ${item.productName} · ${booking.customerName}`}
                >
                  {item.productName}
                </span>
              ))}
              {dayItems.length > 3 && <span className="admin-calendar-more">+{dayItems.length - 3}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AdminCustomers({
  profiles,
  bookings,
}: {
  profiles: UserProfile[];
  bookings: Booking[];
}) {
  const [search, setSearch] = useState("");
  const queryText = search.trim().toLocaleLowerCase("es");
  const filteredProfiles = profiles
    .filter((profile) =>
      !queryText
      || [profile.firstName, profile.lastName, profile.email, profile.dni, profile.phone]
        .some((value) => value?.toLocaleLowerCase("es").includes(queryText)),
    )
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  return (
    <section className="admin-customers">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Directorio simple</h2>
          <p>Datos de contacto e historial de pedidos, sin planillas paralelas.</p>
        </div>
      </div>
      <div className="admin-filter-bar">
        <label>
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, email, DNI o celular" />
        </label>
      </div>
      {filteredProfiles.length === 0 ? (
        <p className="admin-empty-reservations">No hay clientes que coincidan con la búsqueda.</p>
      ) : (
        <div className="admin-customer-list">
          {filteredProfiles.map((profile) => {
            const customerBookings = bookings.filter((booking) => booking.createdByUid === profile.uid);
            const activeCount = customerBookings.filter(isActiveBooking).length;
            return (
              <article key={profile.uid}>
                <div className="admin-customer-avatar"><UserRound size={19} /></div>
                <div>
                  <strong>{`${profile.firstName} ${profile.lastName}`.trim() || "Sin nombre"}</strong>
                  <span>{profile.email}</span>
                </div>
                <div>
                  <span>DNI {profile.dni || "—"}</span>
                  <span>{profile.phone || "Sin celular"}</span>
                </div>
                <div>
                  <strong>{customerBookings.length}</strong>
                  <span>{activeCount} activos</span>
                </div>
                <div className="admin-customer-actions">
                  <a href={`mailto:${profile.email}`}><Mail size={16} /> Email</a>
                  {profile.phone && (
                    <a href={`https://wa.me/${profile.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} /> WhatsApp
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function isUsableImageUrl(image: string) {
  return /^https?:\/\//.test(image) || /^data:image\//.test(image);
}

function AdminImagePreview({ image, onRemove }: { image: string; onRemove: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure>
      {failed
        ? <div className="admin-image-fallback">Imagen no disponible</div>
        : <img src={image} alt="" onError={() => setFailed(true)} />}
      <button type="button" onClick={onRemove}>Quitar</button>
    </figure>
  );
}

type ProductForm = {
  id: string;
  name: string;
  category: Product["category"];
  tags: string;
  rentalPricePerWeek: string;
  description: string;
  curiosities: string;
  status: ProductStatus;
  measurements: string;
  material: string;
  color: string;
  eraStyle: string;
  availability: Availability;
  estimatedValue: string;
  guaranteePercentage: string;
  minimumDeposit: string;
  featuredScore: string;
  stock: string;
  internalNotes: string;
  images: string[];
  visualTone: ProductVisual["tone"];
  visualSigil: string;
};

const emptyForm: ProductForm = {
  id: "",
  name: "",
  category: "Utilería",
  tags: "",
  rentalPricePerWeek: "",
  description: "",
  curiosities: "",
  status: "Excelente",
  measurements: "",
  material: "",
  color: "",
  eraStyle: "",
  availability: "Disponible",
  estimatedValue: "",
  guaranteePercentage: "30",
  minimumDeposit: "",
  featuredScore: "50",
  stock: "1",
  internalNotes: "",
  images: [],
  visualTone: "paper",
  visualSigil: "✶",
};

function toNumber(value: string, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toForm(product: Product): ProductForm {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    tags: product.tags.join(", "),
    rentalPricePerWeek: String(product.rentalPricePerWeek),
    description: product.description,
    curiosities: product.curiosities,
    status: product.status,
    measurements: product.measurements,
    material: product.material,
    color: product.color,
    eraStyle: product.eraStyle,
    availability: product.availability,
    estimatedValue: String(product.estimatedValue),
    guaranteePercentage: String(Math.round(product.guaranteePercentage * 100)),
    minimumDeposit: String(product.minimumDeposit),
    featuredScore: String(product.featuredScore),
    stock: String(product.stock),
    internalNotes: product.internalNotes ?? "",
    images: product.images.filter(isUsableImageUrl),
    visualTone: product.visual.tone,
    visualSigil: product.visual.sigil,
  };
}

function toProduct(form: ProductForm): Product {
  const product: Product = {
    id: form.id.trim(),
    name: form.name.trim(),
    category: form.category,
    tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    rentalPricePerWeek: Math.max(0, toNumber(form.rentalPricePerWeek)),
    description: form.description.trim(),
    curiosities: form.curiosities.trim(),
    status: form.status,
    measurements: form.measurements.trim(),
    material: form.material.trim(),
    color: form.color.trim(),
    eraStyle: form.eraStyle.trim(),
    availability: form.availability,
    estimatedValue: Math.max(0, toNumber(form.estimatedValue)),
    guaranteePercentage: Math.min(1, Math.max(0, toNumber(form.guaranteePercentage, 30) / 100)),
    minimumDeposit: Math.max(0, toNumber(form.minimumDeposit)),
    featuredScore: toNumber(form.featuredScore, 50),
    stock: Math.max(1, Math.floor(toNumber(form.stock, 1))),
    images: form.images.filter(isUsableImageUrl),
    visual: { tone: form.visualTone, sigil: form.visualSigil.trim() || "✶" },
  };
  if (form.internalNotes.trim()) product.internalNotes = form.internalNotes.trim();
  return product;
}

function fileSafeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function getNextProductId(products: Product[]) {
  const highest = products.reduce((max, product) => {
    const numericId = Number(product.id.replace(/\D/g, ""));
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
  }, 0);
  return String(highest + 1).padStart(3, "0");
}

interface CollectionForm {
  id: string;
  title: string;
  description: string;
  productIds: string[];
  coverProductId: string;
  published: boolean;
  order: string;
}

const emptyCollectionForm: CollectionForm = {
  id: "",
  title: "",
  description: "",
  productIds: [],
  coverProductId: "",
  published: true,
  order: "0",
};

function collectionToForm(item: CuratedCollection): CollectionForm {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    productIds: item.productIds,
    coverProductId: item.coverProductId,
    published: item.published,
    order: String(item.order),
  };
}

function collectionSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function AdminCollections({
  collections,
  products,
  onGlobalMessage,
}: {
  collections: CuratedCollection[];
  products: Product[];
  onGlobalMessage: (message: string) => void;
}) {
  const db = getFirebaseDb();
  const [form, setForm] = useState<CollectionForm>(emptyCollectionForm);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );
  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase("es");
    if (!query) return sortedProducts;
    return sortedProducts.filter((product) =>
      `${product.id} ${product.name} ${product.category}`.toLocaleLowerCase("es").includes(query),
    );
  }, [productSearch, sortedProducts]);

  const newCollection = () => {
    setForm(emptyCollectionForm);
    setProductSearch("");
    onGlobalMessage("");
  };

  const toggleProduct = (productId: string) => {
    setForm((current) => {
      const selected = current.productIds.includes(productId);
      const productIds = selected
        ? current.productIds.filter((id) => id !== productId)
        : [...current.productIds, productId];
      const coverProductId = productIds.includes(current.coverProductId)
        ? current.coverProductId
        : productIds[0] ?? "";
      return { ...current, productIds, coverProductId };
    });
  };

  const saveCollection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db) return;
    const title = form.title.trim();
    if (!title) {
      onGlobalMessage("Escribí un nombre para la colección.");
      return;
    }
    const productIds = form.productIds.filter((id) => products.some((product) => product.id === id));
    if (productIds.length === 0) {
      onGlobalMessage("Elegí al menos un producto para la colección.");
      return;
    }

    let id = form.id;
    if (!id) {
      const base = collectionSlug(title) || "coleccion";
      id = collections.some((item) => item.id === base) ? `${base}-${Date.now().toString(36)}` : base;
    }
    const existing = collections.find((item) => item.id === id);
    const now = new Date().toISOString();
    const nextCollection: CuratedCollection = {
      id,
      title,
      description: form.description.trim(),
      productIds,
      coverProductId: productIds.includes(form.coverProductId)
        ? form.coverProductId
        : productIds[0],
      published: form.published,
      order: Number(form.order) || 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const nextCollections = existing
      ? collections.map((item) => item.id === id ? nextCollection : item)
      : [...collections, nextCollection];

    try {
      setSaving(true);
      await setDoc(doc(db, "products", COLLECTIONS_CONFIG_PRODUCT_ID), {
        kind: "collections-config",
        collections: nextCollections,
        updatedAt: serverTimestamp(),
      });
      setForm((current) => ({ ...current, id }));
      onGlobalMessage(`Colección guardada: ${title}.`);
    } catch (error) {
      console.error(error);
      onGlobalMessage("No se pudo guardar la colección. Revisá la conexión y los permisos.");
    } finally {
      setSaving(false);
    }
  };

  const removeCollection = async () => {
    if (!db || !form.id) return;
    if (!window.confirm(`¿Eliminar la colección ${form.title}? Los productos no se eliminarán.`)) return;
    try {
      setSaving(true);
      await setDoc(doc(db, "products", COLLECTIONS_CONFIG_PRODUCT_ID), {
        kind: "collections-config",
        collections: collections.filter((item) => item.id !== form.id),
        updatedAt: serverTimestamp(),
      });
      setForm(emptyCollectionForm);
      onGlobalMessage("Colección eliminada. Los productos siguen en el catálogo.");
    } catch (error) {
      console.error(error);
      onGlobalMessage("No se pudo eliminar la colección.");
    } finally {
      setSaving(false);
    }
  };

  const selectedProducts = form.productIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product) => product !== undefined);

  return (
    <div className="admin-layout admin-collections-layout">
      <aside className="admin-list">
        <button type="button" className="admin-new-button" onClick={newCollection}>
          <Plus size={16} />Nueva colección
        </button>
        {collections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={form.id === item.id ? "is-active" : ""}
            onClick={() => {
              setForm(collectionToForm(item));
              setProductSearch("");
            }}
          >
            <strong>{item.title}</strong>
            <span>{item.productIds.length} objetos · {item.published ? "Publicada" : "Oculta"}</span>
          </button>
        ))}
      </aside>

      <form onSubmit={saveCollection} className="admin-editor admin-collection-editor">
        <div className="admin-editor-title">
          <div>
            <p className="eyebrow">Colección editable</p>
            <h2>{form.title || "Colección nueva"}</h2>
          </div>
          <div className="admin-actions">
            <button type="button" className="gabinete-button-secondary" onClick={removeCollection} disabled={!form.id || saving}>
              <Trash2 size={17} />Eliminar
            </button>
            <button type="submit" className="gabinete-button" disabled={saving}>
              <Save size={17} />{saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>

        <div className="admin-grid admin-collection-fields">
          <label>Nombre<input className="gabinete-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>Orden<input className="gabinete-input" type="number" value={form.order} onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))} /></label>
          <label className="admin-collection-publish">
            <input type="checkbox" checked={form.published} onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))} />
            <span><strong>Publicada</strong><em>Visible para todos en Colecciones</em></span>
          </label>
        </div>

        <label className="admin-wide">Descripción<textarea className="gabinete-input" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Qué une a estas piezas y para qué tipo de escena funcionan." /></label>

        <section className="admin-collection-products">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Contenido</p><h3>Elegí los productos</h3></div>
            <span>{form.productIds.length} seleccionados</span>
          </div>
          <label className="admin-collection-search">
            <Search size={17} />
            <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar por nombre, ID o categoría" />
          </label>
          <div className="admin-product-picker">
            {visibleProducts.map((product) => (
              <label key={product.id} className={form.productIds.includes(product.id) ? "is-selected" : ""}>
                <input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />
                <span className="admin-product-picker-image">
                  {product.images[0] ? <img src={product.images[0]} alt="" /> : <PackageCheck size={20} />}
                </span>
                <span><strong>{product.name}</strong><em>{product.id} · {product.category}</em></span>
              </label>
            ))}
          </div>
        </section>

        {selectedProducts.length > 0 && (
          <label className="admin-wide">Producto de portada
            <select className="gabinete-input" value={form.coverProductId || selectedProducts[0].id} onChange={(event) => setForm((current) => ({ ...current, coverProductId: event.target.value }))}>
              {selectedProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.id}</option>)}
            </select>
          </label>
        )}
      </form>
    </div>
  );
}

function AdminCatalog({
  products,
  bookings,
  onGlobalMessage,
}: {
  products: Product[];
  bookings: Booking[];
  onGlobalMessage: (message: string) => void;
}) {
  const app = getFirebaseApp();
  const db = getFirebaseDb();
  const storage = app ? getStorage(app) : null;
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  const updateField = <K extends keyof ProductForm>(field: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const newProduct = () => {
    setForm({ ...emptyForm, id: getNextProductId(products) });
    setImageUrl("");
    onGlobalMessage("");
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db) return;
    const editedProduct = toProduct(form);
    const currentProduct = products.find((candidate) => candidate.id === editedProduct.id);
    const imagesUnchanged =
      currentProduct && JSON.stringify(currentProduct.images) === JSON.stringify(editedProduct.images);
    const product: Product = imagesUnchanged
      ? {
          ...editedProduct,
          thumbnailImages: currentProduct.thumbnailImages,
          detailImages: currentProduct.detailImages,
        }
      : editedProduct;
    if (!product.id || !product.name) {
      onGlobalMessage("Completá ID y nombre antes de guardar.");
      return;
    }
    if (toNumber(form.guaranteePercentage) < 0 || toNumber(form.guaranteePercentage) > 100) {
      onGlobalMessage("La garantía debe estar entre 0% y 100%.");
      return;
    }

    try {
      setSaving(true);
      await setDoc(doc(db, "products", product.id), product);
      setForm(toForm(product));
      onGlobalMessage(`Producto guardado: ${product.name}.`);
    } catch (error) {
      console.error(error);
      onGlobalMessage("No se pudo guardar el producto. Revisá la conexión y los permisos.");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async () => {
    if (!db || !form.id) return;
    const usedByActiveBooking = bookings.some(
      (booking) => isActiveBooking(booking) && booking.items.some((item) => item.productId === form.id),
    );
    if (usedByActiveBooking) {
      onGlobalMessage("No se puede eliminar: el producto forma parte de una reserva activa.");
      return;
    }
    if (!window.confirm(`¿Eliminar ${form.name || form.id} del catálogo?`)) return;

    try {
      setSaving(true);
      await deleteDoc(doc(db, "products", form.id));
      setForm(emptyForm);
      onGlobalMessage("Producto eliminado del catálogo.");
    } catch (error) {
      console.error(error);
      onGlobalMessage("No se pudo eliminar el producto.");
    } finally {
      setSaving(false);
    }
  };

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!/^https?:\/\//.test(url)) {
      onGlobalMessage("Pegá una URL pública que empiece con http o https.");
      return;
    }
    updateField("images", [url, ...form.images]);
    setImageUrl("");
    onGlobalMessage("Imagen agregada. Guardá el producto para conservarla.");
  };

  const uploadImage = async (file?: File) => {
    if (!file || !storage || !form.id) {
      onGlobalMessage("Completá el ID antes de subir imágenes.");
      return;
    }
    if (!file.type.startsWith("image/") || file.size >= 10 * 1024 * 1024) {
      onGlobalMessage("Elegí una imagen JPG, PNG o WebP de menos de 10 MB.");
      return;
    }
    try {
      setUploading(true);
      const imageRef = ref(storage, `products/${form.id}/${Date.now()}-${fileSafeName(file.name)}`);
      await uploadBytes(imageRef, file, { contentType: file.type });
      const url = await getDownloadURL(imageRef);
      updateField("images", [url, ...form.images]);
      onGlobalMessage("Imagen subida. Guardá el producto para conservarla.");
    } catch (error) {
      console.error(error);
      onGlobalMessage("No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-layout">
      <aside className="admin-list">
        <button type="button" className="admin-new-button" onClick={newProduct}><Plus size={16} />Nuevo producto</button>
        {sortedProducts.map((product) => (
          <button key={product.id} type="button" className={form.id === product.id ? "is-active" : ""} onClick={() => setForm(toForm(product))}>
            <strong>{product.name}</strong>
            <span>{product.id} · {product.category}</span>
          </button>
        ))}
      </aside>

      <form onSubmit={saveProduct} className="admin-editor">
        <div className="admin-editor-title">
          <div><p className="eyebrow">Ficha editable</p><h2>{form.name || "Producto nuevo"}</h2></div>
          <div className="admin-actions">
            <button type="button" className="gabinete-button-secondary" onClick={removeProduct} disabled={!form.id || saving}><Trash2 size={17} />Eliminar</button>
            <button type="submit" className="gabinete-button" disabled={saving}><Save size={17} />{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>

        <div className="admin-grid">
          <label>ID<input className="gabinete-input" value={form.id} onChange={(event) => updateField("id", event.target.value.trim().toUpperCase())} /></label>
          <label>Nombre<input className="gabinete-input" value={form.name} onChange={(event) => updateField("name", event.target.value)} /></label>
          <label>Categoría<select className="gabinete-input" value={form.category} onChange={(event) => updateField("category", event.target.value as Product["category"])}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Estado<select className="gabinete-input" value={form.status} onChange={(event) => updateField("status", event.target.value as ProductStatus)}>{productStatusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Disponibilidad<select className="gabinete-input" value={form.availability} onChange={(event) => updateField("availability", event.target.value as Availability)}>{availabilityOptions.map((availability) => <option key={availability}>{availability}</option>)}</select></label>
          <label>Unidades disponibles<input className="gabinete-input" type="number" min="1" value={form.stock} onChange={(event) => updateField("stock", event.target.value)} /></label>
          <label>Tarifa semanal mínima<input className="gabinete-input" type="number" min="0" value={form.rentalPricePerWeek} onChange={(event) => updateField("rentalPricePerWeek", event.target.value)} /></label>
          <label>Valor estimado<input className="gabinete-input" type="number" min="0" value={form.estimatedValue} onChange={(event) => updateField("estimatedValue", event.target.value)} /></label>
          <label>Garantía (%)<input className="gabinete-input" type="number" min="0" max="100" value={form.guaranteePercentage} onChange={(event) => updateField("guaranteePercentage", event.target.value)} /></label>
          <label>Depósito mínimo<input className="gabinete-input" type="number" min="0" value={form.minimumDeposit} onChange={(event) => updateField("minimumDeposit", event.target.value)} /></label>
          <label>Prioridad en catálogo<input className="gabinete-input" type="number" value={form.featuredScore} onChange={(event) => updateField("featuredScore", event.target.value)} /></label>
          <label>Etiquetas<input className="gabinete-input" value={form.tags} onChange={(event) => updateField("tags", event.target.value)} placeholder="vintage, cocina, exterior" /></label>
          <label>Medidas<input className="gabinete-input" value={form.measurements} onChange={(event) => updateField("measurements", event.target.value)} /></label>
          <label>Material<input className="gabinete-input" value={form.material} onChange={(event) => updateField("material", event.target.value)} /></label>
          <label>Color<input className="gabinete-input" value={form.color} onChange={(event) => updateField("color", event.target.value)} /></label>
          <label>Época / estilo<input className="gabinete-input" value={form.eraStyle} onChange={(event) => updateField("eraStyle", event.target.value)} /></label>
          <label>Tono visual<select className="gabinete-input" value={form.visualTone} onChange={(event) => updateField("visualTone", event.target.value as ProductVisual["tone"])}>{toneOptions.map((tone) => <option key={tone}>{tone}</option>)}</select></label>
          <label>Símbolo<input className="gabinete-input" value={form.visualSigil} onChange={(event) => updateField("visualSigil", event.target.value)} /></label>
        </div>

        <label className="admin-wide">Descripción<textarea className="gabinete-input" rows={4} value={form.description} onChange={(event) => updateField("description", event.target.value)} /></label>
        <label className="admin-wide">Curiosidades<textarea className="gabinete-input" rows={3} value={form.curiosities} onChange={(event) => updateField("curiosities", event.target.value)} /></label>
        <label className="admin-wide">Notas internas<textarea className="gabinete-input" rows={3} value={form.internalNotes} onChange={(event) => updateField("internalNotes", event.target.value)} /></label>

        <div className="admin-images">
          <label className="admin-upload">
            <ImagePlus size={18} />{uploading ? "Subiendo…" : "Subir imagen"}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadImage(event.target.files?.[0])} />
          </label>
          <div className="admin-image-url">
            <label>URL pública<input className="gabinete-input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" /></label>
            <button type="button" className="admin-upload" onClick={addImageUrl}><ImagePlus size={18} />Agregar</button>
          </div>
          <div className="admin-image-grid">
            {form.images.map((image) => (
              <AdminImagePreview key={image} image={image} onRemove={() => updateField("images", form.images.filter((candidate) => candidate !== image))} />
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}

export function AdminPage() {
  const db = getFirebaseDb();
  const { user, isAdmin, checkingAdmin, loginWithGoogle, logout, authError } = useAuth();
  const { products, syncMode } = useCatalog();
  const { collections, loadingCollections } = useCollections();
  const { bookings, loadingBookings } = useAvailability();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  useEffect(() => {
    if (!db || !isAdmin) {
      setProfiles([]);
      return;
    }
    return onSnapshot(
      collection(db, "userProfiles"),
      (snapshot) => setProfiles(snapshot.docs.map((profileDoc) => profileDoc.data() as UserProfile)),
      (error) => {
        console.error(error);
        setMessage("No se pudo cargar el directorio de clientes.");
      },
    );
  }, [db, isAdmin]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    await loginWithGoogle();
  };

  if (!firebaseEnabled || !db) {
    return <section className="admin-page"><div className="admin-card"><h1>Panel no disponible</h1><p>No se pudo conectar con Firebase.</p></div></section>;
  }
  if (!user) {
    return (
      <section className="admin-page">
        <form onSubmit={login} className="admin-card admin-login">
          <span className="admin-lock"><Lock size={22} /></span>
          <p className="eyebrow">Administración</p>
          <h1>Ingresar al panel</h1>
          <p>Usá la cuenta de Google autorizada para gestionar reservas, clientes y catálogo.</p>
          {(message || authError) && <p className="admin-message">{message || authError}</p>}
          <button type="submit" className="gabinete-button"><Lock size={17} />Entrar con Google</button>
        </form>
      </section>
    );
  }
  if (checkingAdmin) {
    return <section className="admin-page"><div className="admin-card">Verificando permisos…</div></section>;
  }
  if (!isAdmin) {
    return (
      <section className="admin-page">
        <div className="admin-card">
          <p className="eyebrow">Sin permiso</p>
          <h1>Tu usuario no es administrador</h1>
          <p>Pedí que autoricen <strong>{user.email}</strong> para acceder.</p>
          <button type="button" className="gabinete-button-secondary" onClick={logout}><LogOut size={17} />Salir</button>
        </div>
      </section>
    );
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: "Resumen", icon: LayoutDashboard },
    { id: "bookings", label: "Reservas", icon: PackageCheck },
    { id: "calendar", label: "Calendario", icon: CalendarDays },
    { id: "customers", label: "Clientes", icon: UsersRound },
    { id: "collections", label: "Colecciones", icon: Layers3 },
    { id: "catalog", label: "Catálogo", icon: UploadCloud },
  ];

  return (
    <section className="admin-page">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Operaciones</p>
          <h1>Panel del rental</h1>
          <p>Lo importante de hoy, reservas, clientes, calendario y catálogo.</p>
        </div>
        <div className="admin-actions">
          <span className="admin-online-status"><span />{syncMode === "firebase" ? "Datos online" : "Modo local"}</span>
          <button type="button" className="gabinete-button-secondary" onClick={logout}><LogOut size={17} />Salir</button>
        </div>
      </div>

      {message && <p className="admin-message"><CheckCircle2 size={16} />{message}</p>}

      <div className="admin-tabs" role="tablist" aria-label="Secciones del panel">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? "is-active" : ""}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {(loadingBookings && activeTab !== "catalog" && activeTab !== "collections") || (loadingCollections && activeTab === "collections") ? (
        <div className="admin-loading" role="status">Actualizando el rental…</div>
      ) : (
        <>
          {activeTab === "overview" && <AdminOverview bookings={bookings} products={products} profiles={profiles} onOpenTab={setActiveTab} />}
          {activeTab === "bookings" && <AdminBookings bookings={bookings} profiles={profiles} />}
          {activeTab === "calendar" && <AdminCalendar bookings={bookings} />}
          {activeTab === "customers" && <AdminCustomers profiles={profiles} bookings={bookings} />}
          {activeTab === "collections" && <AdminCollections collections={collections} products={products} onGlobalMessage={setMessage} />}
          {activeTab === "catalog" && <AdminCatalog products={products} bookings={bookings} onGlobalMessage={setMessage} />}
        </>
      )}
    </section>
  );
}
