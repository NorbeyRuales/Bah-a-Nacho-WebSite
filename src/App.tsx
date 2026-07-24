import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, Menu, X, ChevronDown, ChevronRight, Star, Phone, Mail, MapPin,
  Clock, Anchor, Zap, Shield, Truck, Wrench,
  ChevronLeft, Filter, SlidersHorizontal, MessageCircle, Heart, Share2,
  LayoutDashboard, Package, Tag, Building2, Users, ShoppingCart,
  FileSpreadsheet, BarChart3, Settings, Bell, LogOut, Plus, Edit2, Trash2,
  Download, RefreshCw, AlertTriangle, CheckCircle,
  TrendingDown, ArrowUpRight, ArrowDownRight, Database, History,
  ChevronUp, Grid, List, Award, Navigation, UserRoundCog,
} from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import logoImg from './imports/image.png'
import { LoginPage } from './features/auth/LoginPage'
import { useAuth, type UserProfile } from './features/auth/AuthProvider'
import { CustomerPortal } from './features/customer/CustomerPortal'
import { UserManagement } from './features/admin/UserManagement'
import { InventoryImportPanel } from './features/admin/InventoryImportPanel'
import { ProductImageManager } from './features/admin/ProductImageManager'
import {
  getPublicCatalog,
  type CatalogProduct,
  type ProductAvailability,
} from './features/catalog/catalogService'
import {
  getAuditPage,
  getDashboardSnapshot,
  getInventoryAlerts,
  getInventoryExport,
  getInventoryPage,
  type AuditEntry,
  type DashboardSnapshot,
  type InventoryAlert,
  type InventoryProduct,
  type InventorySort,
} from './features/admin/adminService'

// ─────────────────────────────────────────────
// TYPES & DATA
// ─────────────────────────────────────────────
type Product = CatalogProduct

type View = 'home' | 'catalog' | 'product' | 'account'
type AdminView =
  | 'dashboard' | 'inventory' | 'products' | 'categories' | 'brands'
  | 'suppliers' | 'clients' | 'users' | 'orders' | 'import' | 'reports' | 'audit'
  | 'notifications' | 'settings'

const TESTIMONIALS = [
  { name: 'Ricardo Mendoza', role: 'Capitán de Lancha', rating: 5, comment: 'Llevo 8 años comprando en Bahía Nacho. La calidad de los repuestos es inigualable y siempre tienen lo que necesito para mis Yamaha. El servicio técnico es de primer nivel.', avatar: 'RM' },
  { name: 'Ana Patricia Vargas', role: 'Empresaria Náutica', rating: 5, comment: 'Manejo una flota de 6 embarcaciones y Bahía Nacho es mi proveedor exclusivo. Precios competitivos, entrega rápida y asesoría técnica especializada. Los recomiendo al 100%.', avatar: 'AV' },
  { name: 'Jorge Luis Parra', role: 'Técnico Marino', rating: 5, comment: 'Como mecánico de motores marinos, exijo calidad máxima. Los repuestos originales y alternativos de Bahía Nacho superan mis expectativas. El impeller kit para Yamaha es perfecto.', avatar: 'JP' },
  { name: 'Mariela Ospina', role: 'Deportista Náutica', rating: 4, comment: 'Compré mi hélice Mercury para competición y la diferencia es notable. El equipo me ayudó a elegir el paso correcto para mi embarcación. Excelente atención.', avatar: 'MO' },
]

const SERVICES = [
  { icon: Wrench, title: 'Diagnóstico Técnico', desc: 'Evaluación profesional de motores fuera de borda con equipos de diagnóstico especializados.' },
  { icon: Zap, title: 'Mantenimiento Preventivo', desc: 'Servicio completo de mantenimiento con cambio de impeller, aceite, filtros y revisión eléctrica.' },
  { icon: Shield, title: 'Garantía de Calidad', desc: 'Todos nuestros productos cuentan con garantía certificada y respaldo técnico postventa.' },
  { icon: Truck, title: 'Envío Nacional', desc: 'Despacho a todo el territorio nacional. Embalaje especializado para piezas delicadas.' },
  { icon: Anchor, title: 'Asesoría Especializada', desc: 'Equipo de técnicos con 15+ años de experiencia en motores marinos a su disposición.' },
  { icon: Award, title: 'Importación Directa', desc: 'Importadores directos autorizados. Piezas OEM y alternativas de primera calidad.' },
]

const FAQS = [
  { q: '¿Los repuestos son originales?', a: 'Manejamos tanto repuestos OEM (originales del fabricante) como alternativos de alta calidad. Todos nuestros productos cuentan con certificación de calidad y garantía.' },
  { q: '¿Cómo sé si el repuesto es compatible con mi motor?', a: 'Puedes buscar por referencia, modelo de motor, año o potencia. Nuestro equipo técnico también está disponible vía WhatsApp para asesorarte en la selección correcta.' },
  { q: '¿Tienen servicio de envío a todo el país?', a: 'Sí, realizamos envíos a todo el territorio nacional mediante operadores de carga especializados. El tiempo de entrega varía entre 1-3 días hábiles según la ciudad destino.' },
  { q: '¿Cuál es la garantía de los productos?', a: 'Los repuestos originales tienen garantía de fábrica (6-24 meses según fabricante). Los productos alternativos cuentan con 6 meses de garantía por defectos de fabricación.' },
  { q: '¿Ofrecen crédito o financiamiento?', a: 'Sí, manejamos crédito para clientes frecuentes con historial de compra. Contáctenos para conocer los requisitos y condiciones del crédito empresarial.' },
  { q: '¿Tienen taller de reparación de motores?', a: 'Contamos con taller especializado para diagnóstico y reparación de motores Yamaha, Mercury, Suzuki y Honda. Solicite su cita vía WhatsApp.' },
]

const PIE_COLORS = ['#1565ff', '#00b4d8', '#0ea5e9', '#38bdf8', '#7dd3fc']

// ─────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────
function formatPrice(price: number, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price)
}

function WhatsAppBtn({ text, small }: { text: string; small?: boolean }) {
  return (
    <a
      href={`https://wa.me/573001234567?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 font-semibold rounded-lg transition-all duration-200 ${small
        ? 'bg-[#25D366] hover:bg-[#1db954] text-white text-sm px-3 py-1.5'
        : 'bg-[#25D366] hover:bg-[#1db954] text-white px-5 py-2.5 glow-cyan'
      }`}
    >
      <MessageCircle size={small ? 14 : 18} />
      {small ? 'WhatsApp' : 'Consultar por WhatsApp'}
    </a>
  )
}

function StockBadge({ stock, min }: { stock: number; min: number }) {
  if (stock === 0) return <span className="inline-flex items-center gap-1 bg-red-900/40 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-800">Agotado</span>
  if (stock <= min) return <span className="inline-flex items-center gap-1 bg-yellow-900/40 text-yellow-400 text-xs px-2 py-0.5 rounded-full border border-yellow-800">Stock Bajo</span>
  return <span className="inline-flex items-center gap-1 bg-green-900/40 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-800">Disponible</span>
}

function AvailabilityBadge({ availability }: { availability: ProductAvailability }) {
  if (availability === 'out_of_stock') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-red-800 bg-red-900/40 px-2 py-0.5 text-xs text-red-400">Agotado</span>
  }
  if (availability === 'low_stock') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-yellow-800 bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-400">Pocas unidades</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-green-800 bg-green-900/40 px-2 py-0.5 text-xs text-green-400">Disponible</span>
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// PUBLIC NAVBAR
// ─────────────────────────────────────────────
function PublicNavbar({ onAccountClick, accountLabel, currentSection, onNav }: {
  onAccountClick: () => void
  accountLabel: string
  currentSection: string
  onNav: (s: string) => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const links = ['Inicio', 'Catálogo', 'Motores', 'Repuestos', 'Accesorios', 'Servicios', 'Nosotros', 'Contacto']

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass shadow-lg shadow-black/30' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={() => onNav('home')} className="flex items-center gap-2">
          <img src={logoImg} alt="Bahía Nacho" className="h-12 w-auto object-contain" />
        </button>

        <div className="hidden lg:flex items-center gap-1">
          {links.map(l => (
            <button
              key={l}
              onClick={() => onNav(l.toLowerCase())}
              className={`nav-link px-3 py-2 text-sm font-medium transition-colors duration-200 ${currentSection === l.toLowerCase() ? 'text-[#00b4d8] active' : 'text-[#93c5fd] hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <a href="tel:+573001234567" className="flex items-center gap-1.5 text-[#93c5fd] hover:text-white text-sm transition-colors">
            <Phone size={14} />
            <span>+57 300 123 4567</span>
          </a>
          <button onClick={onAccountClick} className="bg-[#1565ff] hover:bg-[#1252d3] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 glow-blue">
            {accountLabel}
          </button>
        </div>

        <button className="lg:hidden text-[#93c5fd]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden glass border-t border-[#1e3a5f]">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map(l => (
              <button key={l} onClick={() => { onNav(l.toLowerCase()); setMobileOpen(false) }}
                className="text-left px-3 py-2.5 text-[#93c5fd] hover:text-white hover:bg-[#1565ff]/10 rounded-lg text-sm font-medium transition-colors">
                {l}
              </button>
            ))}
            <button onClick={onAccountClick} className="mt-2 bg-[#1565ff] text-white py-2 rounded-lg text-sm font-semibold">
              {accountLabel}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─────────────────────────────────────────────
// HERO SECTION
// ─────────────────────────────────────────────
function HeroSection({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState('')

  const handleSearch = () => {
    if (query.trim()) onSearch(query)
  }

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(6,13,26,0.92) 0%, rgba(10,31,78,0.85) 50%, rgba(10,58,122,0.75) 100%), url(https://images.unsplash.com/photo-1585000962552-70f0a67223d9?w=1920&h=1080&fit=crop&auto=format)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Animated particles overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#1565ff]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00b4d8]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 pt-20">
        <div className="inline-flex items-center gap-2 bg-[#1565ff]/20 border border-[#1565ff]/40 text-[#93c5fd] text-sm px-4 py-1.5 rounded-full mb-6">
          <Anchor size={14} />
          <span>Distribuidores Autorizados · Repuestos Garantizados</span>
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-bold text-white leading-tight mb-4">
          Tu Motor,{' '}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #1565ff, #00b4d8)' }}>
            Nuestra Especialidad
          </span>
        </h1>

        <p className="text-[#93c5fd] text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
          Repuestos originales y alternativos para motores fuera de borda Yamaha, Mercury, Suzuki, Honda y más.
          Más de 2,000 referencias disponibles con despacho inmediato.
        </p>

        {/* Big search box */}
        <div className="glass rounded-2xl p-2 max-w-2xl mx-auto shadow-2xl">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar por nombre, referencia, marca o modelo…"
                className="w-full bg-transparent pl-11 pr-4 py-4 text-white placeholder-[#64748b] text-base outline-none"
              />
            </div>
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 font-semibold px-6 py-4 rounded-xl text-white transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #1565ff, #00b4d8)' }}
            >
              <Search size={18} />
              <span className="hidden sm:inline">Buscar</span>
            </button>
          </div>
          <div className="flex gap-2 px-3 pb-1 flex-wrap">
            {['Impeller Yamaha', 'Hélice Mercury 90 HP', 'Carburador Suzuki', 'Kit arranque'].map(t => (
              <button key={t} onClick={() => { setQuery(t); onSearch(t) }}
                className="text-xs text-[#64748b] hover:text-[#00b4d8] transition-colors py-1">
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {[
            { label: 'Productos', value: '2,000+' },
            { label: 'Marcas', value: '8+' },
            { label: 'Años de Exp.', value: '15' },
            { label: 'Clientes', value: '5,000+' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="font-display text-2xl font-bold text-white">{s.value}</div>
              <div className="text-[#64748b] text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[#64748b] text-xs animate-bounce">
        <span>Explorar</span>
        <ChevronDown size={16} />
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// PRODUCT CARD
// ─────────────────────────────────────────────
function ProductCard({ product, onDetail }: { product: Product; onDetail: (p: Product) => void }) {
  return (
    <div
      className="product-card glass rounded-2xl overflow-hidden border border-[#1e3a5f] cursor-pointer"
      onClick={() => onDetail(product)}
    >
      <div className="relative h-48 bg-[#0a1628]">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = '/bahia-nacho-favicon.png' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060d1a]/60 to-transparent" />
        <div className="absolute top-3 left-3">
          <AvailabilityBadge availability={product.availability} />
        </div>
        {product.featured && (
          <div className="absolute top-3 right-3 bg-[#1565ff] text-white text-xs px-2 py-0.5 rounded-full font-semibold">
            Destacado
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="font-mono text-xs text-[#64748b] mb-1">Referencia: {product.oemCode}</div>
        <h3 className="font-semibold text-white text-sm leading-snug mb-2 line-clamp-2">{product.name}</h3>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="bg-[#0a2a5e] text-[#93c5fd] text-xs px-2 py-0.5 rounded-full">{product.brand}</span>
          <span className="bg-[#0a2a5e] text-[#93c5fd] text-xs px-2 py-0.5 rounded-full">{product.category}</span>
        </div>
        {product.compatibility.length > 0 && (
          <div className="text-xs text-[#64748b] mb-3 line-clamp-1">
            Compatible: {product.compatibility.slice(0, 2).join(', ')}{product.compatibility.length > 2 && ' +más'}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-bold text-white">{formatPrice(product.price, product.currencyCode)}</span>
          <WhatsAppBtn text={`Hola, me interesa el producto: ${product.name} (Referencia: ${product.oemCode})`} small />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// CATALOG PAGE
// ─────────────────────────────────────────────
function CatalogPage({
  products,
  loading,
  error,
  onRetry,
  onDetail,
  initialQuery,
}: {
  products: Product[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onDetail: (p: Product) => void
  initialQuery: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [availability, setAvailability] = useState<'all' | 'available' | 'low'>('all')
  const [priceMax, setPriceMax] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const brands = useMemo(
    () => Array.from(new Set(products.map(product => product.brand))).sort((a, b) => a.localeCompare(b, 'es')),
    [products],
  )
  const categories = useMemo(
    () => Array.from(new Set(products.map(product => product.category))).sort((a, b) => a.localeCompare(b, 'es')),
    [products],
  )
  const catalogMaxPrice = useMemo(
    () => Math.max(1, ...products.map(product => Math.ceil(product.price))),
    [products],
  )
  const effectivePriceMax = priceMax ?? catalogMaxPrice

  const filtered = products.filter(p => {
    const q = query.toLowerCase()
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.oemCode.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.compatibility.some(c => c.toLowerCase().includes(q))
    const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(p.brand)
    const matchCat = selectedCats.length === 0 || selectedCats.includes(p.category)
    const matchAvail = availability === 'all'
      || (availability === 'available' && p.availability === 'available')
      || (availability === 'low' && p.availability === 'low_stock')
    const matchPrice = p.price <= effectivePriceMax
    return matchQ && matchBrand && matchCat && matchAvail && matchPrice
  })

  const toggleBrand = (b: string) => setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const toggleCat = (c: string) => setSelectedCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  return (
    <div className="min-h-screen pt-20 bg-[#060d1a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Catálogo de Productos</h1>
            <p className="text-[#64748b] text-sm mt-1">{filtered.length} productos encontrados</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 glass border border-[#1e3a5f] text-[#93c5fd] px-3 py-2 rounded-lg text-sm hover:border-[#1565ff] transition-all">
              <SlidersHorizontal size={15} />
              Filtros
            </button>
            <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="glass border border-[#1e3a5f] text-[#93c5fd] p-2 rounded-lg hover:border-[#1565ff] transition-all">
              {viewMode === 'grid' ? <List size={18} /> : <Grid size={18} />}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre, referencia, marca o compatibilidad…"
            className="w-full glass border border-[#1e3a5f] focus:border-[#1565ff] bg-transparent pl-10 pr-4 py-3 text-white placeholder-[#64748b] rounded-xl outline-none transition-all"
          />
        </div>

        <div className="flex gap-6">
          {/* Filters sidebar */}
          {showFilters && (
            <div className="w-60 flex-shrink-0 space-y-5">
              <div className="glass border border-[#1e3a5f] rounded-xl p-4">
                <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2"><Filter size={14} /> Marca</h3>
                <div className="space-y-2">
                  {brands.map(b => (
                    <label key={b} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={selectedBrands.includes(b)} onChange={() => toggleBrand(b)} className="accent-[#1565ff]" />
                      <span className="text-sm text-[#93c5fd] group-hover:text-white transition-colors">{b}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="glass border border-[#1e3a5f] rounded-xl p-4">
                <h3 className="font-semibold text-white text-sm mb-3">Categoría</h3>
                <div className="space-y-2">
                  {categories.map(c => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={selectedCats.includes(c)} onChange={() => toggleCat(c)} className="accent-[#1565ff]" />
                      <span className="text-xs text-[#93c5fd] group-hover:text-white transition-colors">{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="glass border border-[#1e3a5f] rounded-xl p-4">
                <h3 className="font-semibold text-white text-sm mb-3">Disponibilidad</h3>
                <div className="space-y-2">
                  {[['all', 'Todos'], ['available', 'Disponible'], ['low', 'Pocas unidades']].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" name="avail" value={v} checked={availability === v} onChange={() => setAvailability(v as 'all' | 'available' | 'low')} className="accent-[#1565ff]" />
                      <span className="text-sm text-[#93c5fd] group-hover:text-white transition-colors">{l}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="glass border border-[#1e3a5f] rounded-xl p-4">
                <h3 className="font-semibold text-white text-sm mb-3">Precio máximo</h3>
                <input
                  type="range"
                  min={0}
                  max={catalogMaxPrice}
                  step={Math.max(1, Math.ceil(catalogMaxPrice / 200))}
                  value={effectivePriceMax}
                  onChange={e => setPriceMax(+e.target.value)}
                  className="w-full accent-[#1565ff]"
                />
                <div className="text-[#00b4d8] text-sm mt-1 font-mono">{formatPrice(effectivePriceMax)}</div>
              </div>

              <button onClick={() => { setSelectedBrands([]); setSelectedCats([]); setAvailability('all'); setPriceMax(null) }}
                className="w-full text-center text-sm text-[#64748b] hover:text-[#1565ff] transition-colors">
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Products grid */}
          <div className="flex-1">
            {loading ? (
              <AdminLoading message="Cargando catálogo…" />
            ) : error ? (
              <AdminError message={error} onRetry={onRetry} />
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-[#64748b]">
                <Package size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg">No se encontraron productos</p>
                <p className="text-sm">Intenta con otros términos de búsqueda</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3'}>
                {filtered.map(p => (
                  viewMode === 'grid'
                    ? <ProductCard key={p.id} product={p} onDetail={onDetail} />
                    : <ProductListRow key={p.id} product={p} onDetail={onDetail} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductListRow({ product, onDetail }: { product: Product; onDetail: (p: Product) => void }) {
  return (
    <div onClick={() => onDetail(product)} className="product-card glass border border-[#1e3a5f] rounded-xl p-4 flex gap-4 cursor-pointer">
      <img src={product.image} alt={product.name} className="w-20 h-20 object-cover rounded-lg flex-shrink-0 bg-[#0a1628]"
        onError={e => { (e.target as HTMLImageElement).src = '/bahia-nacho-favicon.png' }} />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-[#64748b] mb-0.5">Referencia: {product.oemCode}</div>
        <h3 className="font-semibold text-white text-sm mb-1">{product.name}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#0a2a5e] text-[#93c5fd] text-xs px-2 py-0.5 rounded-full">{product.brand}</span>
          <AvailabilityBadge availability={product.availability} />
          {product.compatibility.length > 0 && <span className="text-[#64748b] text-xs">{product.compatibility.slice(0, 2).join(', ')}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <span className="font-display text-xl font-bold text-white">{formatPrice(product.price, product.currencyCode)}</span>
        <WhatsAppBtn text={`Consulta: ${product.name} (Referencia: ${product.oemCode})`} small />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PRODUCT DETAIL PAGE
// ─────────────────────────────────────────────
function ProductDetailPage({
  product,
  products,
  onBack,
  onDetail,
}: {
  product: Product
  products: Product[]
  onBack: () => void
  onDetail: (product: Product) => void
}) {
  const [activeImg, setActiveImg] = useState(0)
  const allImgs = [product.image, ...product.images].filter((v, i, arr) => arr.indexOf(v) === i)

  return (
    <div className="min-h-screen pt-20 bg-[#060d1a]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-[#93c5fd] hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft size={16} /> Volver al catálogo
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="glass border border-[#1e3a5f] rounded-2xl overflow-hidden h-80 mb-3">
              <img src={allImgs[activeImg]} alt={product.name} className="w-full h-full object-cover bg-[#0a1628]"
                onError={e => { (e.target as HTMLImageElement).src = '/bahia-nacho-favicon.png' }} />
            </div>
            {allImgs.length > 1 && (
              <div className="flex gap-2">
                {allImgs.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${activeImg === i ? 'border-[#1565ff]' : 'border-[#1e3a5f]'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover bg-[#0a1628]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#1565ff]/20 border border-[#1565ff]/40 text-[#93c5fd] text-xs px-3 py-1 rounded-full">{product.brand}</span>
              <span className="bg-[#1565ff]/20 border border-[#1565ff]/40 text-[#93c5fd] text-xs px-3 py-1 rounded-full">{product.category}</span>
            </div>

            <h1 className="font-display text-3xl font-bold text-white mb-2">{product.name}</h1>
            <div className="font-mono text-sm text-[#64748b] mb-4">
              Referencia: <span className="text-[#00b4d8]">{product.oemCode}</span>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <span className="font-display text-4xl font-bold text-white">{formatPrice(product.price, product.currencyCode)}</span>
              <AvailabilityBadge availability={product.availability} />
            </div>

            <p className="text-[#93c5fd] leading-relaxed mb-6">{product.description}</p>

            {/* Compatibility */}
            {product.compatibility.length > 0 && (
              <div className="glass border border-[#1e3a5f] rounded-xl p-4 mb-4">
                <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><CheckCircle size={14} className="text-[#00b4d8]" /> Compatibilidad</h3>
                <div className="flex flex-wrap gap-2">
                  {product.compatibility.map(c => (
                    <span key={c} className="bg-[#0a2a5e] text-[#93c5fd] text-xs px-3 py-1 rounded-full border border-[#1e3a5f]">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Specs */}
            <div className="glass border border-[#1e3a5f] rounded-xl p-4 mb-6">
              <h3 className="text-white font-semibold text-sm mb-3">Especificaciones Técnicas</h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs border-b border-[#1e3a5f] pb-1">
                    <span className="text-[#64748b]">{k}</span>
                    <span className="text-white font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <WhatsAppBtn text={`Hola! Quiero consultar sobre: ${product.name}\nReferencia: ${product.oemCode}`} />
              <button className="flex items-center justify-center gap-2 glass border border-[#1e3a5f] hover:border-[#1565ff] text-[#93c5fd] hover:text-white px-5 py-2.5 rounded-lg transition-all font-semibold text-sm">
                <Phone size={16} /> Llamar
              </button>
              <button className="flex items-center justify-center gap-2 glass border border-[#1e3a5f] hover:border-[#1565ff] text-[#93c5fd] hover:text-white px-5 py-2.5 rounded-lg transition-all">
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Related products */}
        <div className="mt-12">
          <h2 className="font-display text-2xl font-bold text-white mb-4">Productos Relacionados</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.filter(p => p.id !== product.id && (p.brand === product.brand || p.category === product.category)).slice(0, 4).map(p => (
              <ProductCard key={p.id} product={p} onDetail={onDetail} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// HOME PAGE SECTIONS
// ─────────────────────────────────────────────
function FeaturedSection({
  products,
  loading,
  error,
  onRetry,
  onDetail,
  onCatalog,
}: {
  products: Product[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onDetail: (p: Product) => void
  onCatalog: () => void
}) {
  return (
    <section className="py-16 max-w-7xl mx-auto px-4">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-[#00b4d8] text-sm font-semibold uppercase tracking-widest mb-2">Productos Destacados</div>
          <h2 className="font-display text-4xl font-bold text-white">Más Vendidos</h2>
        </div>
        <button onClick={onCatalog} className="hidden sm:flex items-center gap-2 text-[#93c5fd] hover:text-white text-sm transition-colors">
          Ver todo el catálogo <ChevronRight size={16} />
        </button>
      </div>
      {loading ? (
        <AdminLoading message="Cargando productos destacados…" />
      ) : error ? (
        <AdminError message={error} onRetry={onRetry} />
      ) : products.length === 0 ? (
        <AdminEmpty message="El catálogo está vacío. Importa el inventario desde el panel de gestión." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.filter(p => p.featured).slice(0, 4).map(p => (
            <ProductCard key={p.id} product={p} onDetail={onDetail} />
          ))}
        </div>
      )}
      <div className="text-center mt-8">
        <button onClick={onCatalog} className="inline-flex items-center gap-2 border border-[#1565ff] text-[#1565ff] hover:bg-[#1565ff] hover:text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200">
          Ver Catálogo Completo <ChevronRight size={18} />
        </button>
      </div>
    </section>
  )
}

function BrandsSection({ brands }: { brands: string[] }) {
  return (
    <section className="py-16 border-y border-[#1e3a5f]" style={{ background: 'linear-gradient(180deg, #060d1a 0%, #0a1f4e 50%, #060d1a 100%)' }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <div className="text-[#00b4d8] text-sm font-semibold uppercase tracking-widest mb-2">Distribuidores Oficiales</div>
          <h2 className="font-display text-4xl font-bold text-white">Marcas que Comercializamos</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {brands.slice(0, 8).map((brand, i) => (
            <div key={brand} className="glass border border-[#1e3a5f] hover:border-[#1565ff] rounded-2xl p-6 text-center transition-all duration-300 group cursor-default">
              <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-full"
                style={{ background: `linear-gradient(135deg, ${['#1565ff', '#00b4d8', '#0ea5e9', '#38bdf8', '#1565ff', '#00b4d8', '#0ea5e9', '#38bdf8'][i]}22, ${['#1565ff', '#00b4d8', '#0ea5e9', '#38bdf8', '#1565ff', '#00b4d8', '#0ea5e9', '#38bdf8'][i]}44)` }}>
                <Anchor size={22} className="text-[#00b4d8] group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-display text-lg font-bold text-white">{brand}</div>
              <div className="text-[#64748b] text-xs mt-1">Repuestos Originales</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ServicesSection() {
  return (
    <section className="py-16 max-w-7xl mx-auto px-4">
      <div className="text-center mb-10">
        <div className="text-[#00b4d8] text-sm font-semibold uppercase tracking-widest mb-2">Lo Que Hacemos</div>
        <h2 className="font-display text-4xl font-bold text-white">Nuestros Servicios</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {SERVICES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass border border-[#1e3a5f] hover:border-[#1565ff] rounded-2xl p-6 transition-all duration-300 group">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl mb-4"
              style={{ background: 'linear-gradient(135deg, #1565ff22, #00b4d844)' }}>
              <Icon size={22} className="text-[#00b4d8] group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-[#64748b] text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="py-16 border-y border-[#1e3a5f]" style={{ background: 'linear-gradient(180deg, #060d1a 0%, #0a1628 100%)' }}>
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-10">
          <div className="text-[#00b4d8] text-sm font-semibold uppercase tracking-widest mb-2">FAQ</div>
          <h2 className="font-display text-4xl font-bold text-white">Preguntas Frecuentes</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className={`glass border rounded-xl overflow-hidden transition-all duration-200 ${open === i ? 'border-[#1565ff]' : 'border-[#1e3a5f]'}`}>
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold text-white text-sm">{faq.q}</span>
                <ChevronDown size={16} className={`text-[#64748b] transition-transform flex-shrink-0 ml-3 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-[#93c5fd] text-sm leading-relaxed border-t border-[#1e3a5f] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsSection() {
  return (
    <section className="py-16 max-w-7xl mx-auto px-4">
      <div className="text-center mb-10">
        <div className="text-[#00b4d8] text-sm font-semibold uppercase tracking-widest mb-2">Testimonios</div>
        <h2 className="font-display text-4xl font-bold text-white">Lo Que Dicen Nuestros Clientes</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="glass border border-[#1e3a5f] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #1565ff, #00b4d8)' }}>
                {t.avatar}
              </div>
              <div>
                <div className="font-semibold text-white text-sm">{t.name}</div>
                <div className="text-[#64748b] text-xs">{t.role}</div>
              </div>
            </div>
            <Stars rating={t.rating} />
            <p className="text-[#93c5fd] text-sm leading-relaxed flex-1">"{t.comment}"</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function LocationSection() {
  return (
    <section className="py-16 bg-[#0a1628] border-y border-[#1e3a5f]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[#00b4d8] text-sm font-semibold uppercase tracking-widest mb-2">Ubicación</div>
            <h2 className="font-display text-4xl font-bold text-white mb-6">Encuéntranos</h2>
            <div className="space-y-4">
              {[
                { icon: MapPin, label: 'Dirección', value: 'Cra. 45 #120-65, Barranquilla, Colombia' },
                { icon: Phone, label: 'Teléfono', value: '+57 (5) 300 123 4567' },
                { icon: Mail, label: 'Email', value: 'info@bahianacho.com' },
                { icon: Clock, label: 'Horario', value: 'Lun – Sab: 7:00 AM – 6:00 PM' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#1565ff]/20 flex-shrink-0">
                    <Icon size={18} className="text-[#00b4d8]" />
                  </div>
                  <div>
                    <div className="text-[#64748b] text-xs">{label}</div>
                    <div className="text-white font-medium text-sm">{value}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <WhatsAppBtn text="Hola Bahía Nacho, necesito información sobre sus productos y servicios." />
            </div>
          </div>
          <div className="glass border border-[#1e3a5f] rounded-2xl overflow-hidden h-72 lg:h-96 flex items-center justify-center bg-[#0a1628]">
            <div className="text-center text-[#64748b]">
              <Navigation size={40} className="mx-auto mb-3 text-[#1565ff] opacity-60" />
              <p className="text-sm">Mapa — Cra. 45 #120-65</p>
              <p className="text-xs mt-1">Barranquilla, Colombia</p>
              <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-4 text-[#1565ff] hover:text-[#00b4d8] text-xs transition-colors">
                Abrir en Google Maps <ChevronRight size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer({ onNav }: { onNav: (s: string) => void }) {
  return (
    <footer className="bg-[#060d1a] border-t border-[#1e3a5f]">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <img src={logoImg} alt="Bahía Nacho" className="h-14 object-contain mb-4" />
            <p className="text-[#64748b] text-sm leading-relaxed mb-4">
              Especialistas en motores fuera de borda, repuestos originales y accesorios náuticos. 15 años de experiencia en el mercado marino colombiano.
            </p>
            <div className="flex gap-3">
              {[MessageCircle, Heart, Share2].map((Icon, i) => (
                <button key={i} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#0d1f3c] hover:bg-[#1565ff] text-[#64748b] hover:text-white transition-all">
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-display font-bold text-white mb-4">Productos</h3>
            <ul className="space-y-2">
              {['Motores Yamaha', 'Motores Mercury', 'Motores Suzuki', 'Hélices', 'Repuestos', 'Accesorios Náuticos'].map(l => (
                <li key={l}>
                  <button onClick={() => onNav('catálogo')} className="text-[#64748b] hover:text-[#00b4d8] text-sm transition-colors text-left">{l}</button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display font-bold text-white mb-4">Empresa</h3>
            <ul className="space-y-2">
              {['Sobre Nosotros', 'Servicios', 'Garantías', 'Política de Envío', 'Contáctenos'].map(l => (
                <li key={l}>
                  <button className="text-[#64748b] hover:text-[#00b4d8] text-sm transition-colors text-left">{l}</button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display font-bold text-white mb-4">Contacto</h3>
            <div className="space-y-3 text-sm text-[#64748b]">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-[#00b4d8] mt-0.5 flex-shrink-0" />
                <span>Cra. 45 #120-65, Barranquilla</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-[#00b4d8]" />
                <span>+57 300 123 4567</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[#00b4d8]" />
                <span>info@bahianacho.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[#00b4d8]" />
                <span>Lun–Sab: 7am–6pm</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-[#1e3a5f] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#64748b] text-xs">
          <p>© 2026 Bahía Nacho. Todos los derechos reservados.</p>
          <p>MOTORES · REPUESTOS · ACCESORIOS · SERVICIO</p>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────
// ADMIN LAYOUT
// ─────────────────────────────────────────────
const ADMIN_NAV: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  view: AdminView
  permission: string
}[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard', permission: 'dashboard.read' },
  { icon: Database, label: 'Inventario', view: 'inventory', permission: 'inventory.read' },
  { icon: Package, label: 'Productos', view: 'products', permission: 'products.read' },
  { icon: Tag, label: 'Categorías', view: 'categories', permission: 'products.read' },
  { icon: Building2, label: 'Marcas', view: 'brands', permission: 'products.read' },
  { icon: Truck, label: 'Proveedores', view: 'suppliers', permission: 'suppliers.read' },
  { icon: Users, label: 'Clientes', view: 'clients', permission: 'clients.read' },
  { icon: UserRoundCog, label: 'Usuarios', view: 'users', permission: 'users.read' },
  { icon: ShoppingCart, label: 'Órdenes', view: 'orders', permission: 'inquiries.read' },
  { icon: FileSpreadsheet, label: 'Importar Excel', view: 'import', permission: 'imports.read' },
  { icon: BarChart3, label: 'Reportes', view: 'reports', permission: 'reports.read' },
  { icon: History, label: 'Auditoría', view: 'audit', permission: 'audit.read' },
  { icon: Bell, label: 'Notificaciones', view: 'notifications', permission: 'inventory.read' },
  { icon: Settings, label: 'Configuración', view: 'settings', permission: 'settings.read' },
]

function AdminSidebar({ current, onNav, onPublic, onSignOut, permissions, collapsed, setCollapsed }: {
  current: AdminView; onNav: (v: AdminView) => void; onPublic: () => void; onSignOut: () => void
  permissions: string[]
  collapsed: boolean; setCollapsed: (v: boolean) => void
}) {
  const visibleNavigation = ADMIN_NAV.filter(item => permissions.includes(item.permission))

  return (
    <aside className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col glass border-r border-[#1e3a5f] transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo area */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-[#1e3a5f]">
        {!collapsed && <img src={logoImg} alt="Bahía Nacho" className="h-10 object-contain" />}
        <button onClick={() => setCollapsed(!collapsed)} className="text-[#64748b] hover:text-white transition-colors ml-auto">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {visibleNavigation.map(({ icon: Icon, label, view }) => (
          <button
            key={view}
            onClick={() => onNav(view)}
            className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative ${current === view ? 'active text-white bg-[#1565ff]/20 border-l-[3px] border-[#00b4d8]' : 'text-[#93c5fd] hover:text-white border-l-[3px] border-transparent'}`}
          >
            <Icon size={17} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium truncate">{label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-[#1e3a5f] p-3 space-y-1">
        <button onClick={onPublic} className="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#93c5fd] hover:text-white border-l-[3px] border-transparent transition-all">
          <Navigation size={17} className="flex-shrink-0" />
          {!collapsed && <span className="font-medium">Ver Sitio</span>}
        </button>
        <button onClick={onSignOut} className="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 border-l-[3px] border-transparent transition-all">
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span className="font-medium">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  )
}

function AdminTopbar({ title, subtitle, notifications, profile, onNotifications }: {
  title: string
  subtitle?: string
  notifications: number
  profile: UserProfile
  onNotifications: () => void
}) {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || profile.email
  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() || profile.email[0].toUpperCase()

  return (
    <header className="h-16 flex items-center justify-between px-6 glass border-b border-[#1e3a5f]">
      <div>
        <h1 className="font-display text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-[#64748b] text-xs">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onNotifications} aria-label="Abrir alertas de inventario" className="relative text-[#64748b] hover:text-white transition-colors">
          <Bell size={20} />
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#1565ff] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center badge-pulse">
              {notifications}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1565ff] to-[#00b4d8] flex items-center justify-center text-white text-sm font-bold">{initials}</div>
          <div className="hidden sm:block">
            <div className="text-white text-xs font-medium max-w-44 truncate">{fullName}</div>
            <div className="text-[#64748b] text-xs">{profile.role.name}</div>
          </div>
        </div>
      </div>
    </header>
  )
}

function formatDate(value: string, includeTime = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(date)
}

function formatCurrency(value: number, currency = 'COP') {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${new Intl.NumberFormat('es-CO').format(value)}`
  }
}

function downloadCsv(fileName: string, rows: Array<Array<string | number>>) {
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  const csv = `\uFEFF${rows.map(row => row.map(escapeCell).join(',')).join('\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function AdminLoading({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-[#93c5fd] ${compact ? 'py-8' : 'min-h-64'}`} role="status">
      <RefreshCw size={18} className="animate-spin text-[#1565ff]" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

function AdminError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="glass border border-red-800/70 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-red-300">
      <AlertTriangle size={17} className="flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="text-white hover:text-red-200 font-medium">Reintentar</button>}
    </div>
  )
}

function AdminEmpty({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`text-center text-[#64748b] ${compact ? 'py-5' : 'py-12'}`}>
      <Database size={compact ? 22 : 34} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function AuditActionBadge({ action }: { action: AuditEntry['action'] }) {
  const styles = action === 'insert'
    ? 'bg-green-900/40 text-green-400 border-green-800'
    : action === 'delete'
      ? 'bg-red-900/40 text-red-400 border-red-800'
      : 'bg-yellow-900/40 text-yellow-400 border-yellow-800'
  const label = action === 'insert' ? 'Creación' : action === 'delete' ? 'Eliminación' : 'Actualización'
  return <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${styles}`}>{label}</span>
}

// ─────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────
function AdminDashboard({ onAudit }: { onAudit: () => void }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await getDashboardSnapshot())
    } catch {
      setError('No fue posible cargar los indicadores desde Supabase.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const inventoryChartData = useMemo(() => (snapshot?.inventoryActivity ?? []).map(row => ({
    month: new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(new Date(`${row.month}-01T12:00:00`)),
    entradas: row.entries,
    salidas: row.exits,
    neto: row.net,
  })), [snapshot])
  const salesByCategory = snapshot?.categoryDistribution ?? []

  const stats = snapshot ? [
    { label: 'Productos Registrados', value: snapshot.stats.products, change: 'Datos actuales', icon: Package, trend: 'neutral', color: '#1565ff' },
    { label: 'Stock Disponible', value: snapshot.stats.totalStock, change: 'Todas las bodegas', icon: Database, trend: 'neutral', color: '#00b4d8' },
    { label: 'Productos Agotados', value: snapshot.stats.outOfStock, change: 'Requieren atención', icon: AlertTriangle, trend: 'down', color: '#ef4444' },
    { label: 'Stock Bajo', value: snapshot.stats.lowStock, change: 'Bajo el mínimo', icon: TrendingDown, trend: 'down', color: '#f59e0b' },
    { label: 'Consultas Hoy', value: snapshot.stats.inquiriesToday, change: 'Desde medianoche', icon: MessageCircle, trend: 'neutral', color: '#10b981' },
    { label: 'Marcas Activas', value: snapshot.stats.activeBrands, change: 'Catálogo disponible', icon: Award, trend: 'neutral', color: '#8b5cf6' },
  ] : []

  if (loading) return <AdminLoading message="Cargando indicadores reales…" />
  if (error || !snapshot) return <AdminError message={error ?? 'No hay datos disponibles.'} onRetry={loadDashboard} />

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="glass border border-[#1e3a5f] rounded-xl p-5 flex gap-4 items-start">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}22` }}>
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[#64748b] text-xs mb-1">{s.label}</div>
              <div className="font-display text-2xl font-bold text-white mb-1">{new Intl.NumberFormat('es-CO').format(s.value)}</div>
              <div className={`text-xs flex items-center gap-1 ${s.trend === 'up' ? 'text-green-400' : s.trend === 'down' ? 'text-red-400' : 'text-[#64748b]'}`}>
                {s.trend === 'up' ? <ArrowUpRight size={12} /> : s.trend === 'down' ? <ArrowDownRight size={12} /> : null}
                {s.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="xl:col-span-2 glass border border-[#1e3a5f] rounded-xl p-5">
          <h3 className="font-display font-bold text-white mb-4">Movimiento de Inventario — últimos 7 meses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={inventoryChartData}>
              <defs>
                <linearGradient id="entradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1565ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1565ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="salidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0d1f3c', border: '1px solid #1e3a5f', borderRadius: '8px', color: '#e8f0fe', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#93c5fd' }} />
              <Area type="monotone" dataKey="entradas" stroke="#1565ff" fill="url(#entradas)" strokeWidth={2} name="Entradas" />
              <Area type="monotone" dataKey="salidas" stroke="#00b4d8" fill="url(#salidas)" strokeWidth={2} name="Salidas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="glass border border-[#1e3a5f] rounded-xl p-5">
          <h3 className="font-display font-bold text-white mb-4">Productos por Categoría</h3>
          {salesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={salesByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {salesByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0d1f3c', border: '1px solid #1e3a5f', borderRadius: '8px', color: '#e8f0fe', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <AdminEmpty message="Aún no hay productos registrados." compact />}
          <div className="space-y-1.5">
            {salesByCategory.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-[#93c5fd]">{s.name}</span>
                </div>
                <span className="text-white font-medium font-mono">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent audit */}
      <div className="glass border border-[#1e3a5f] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white">Actividad Reciente</h3>
          <button onClick={onAudit} className="text-[#1565ff] hover:text-[#00b4d8] text-xs transition-colors">Ver todo</button>
        </div>
        <div className="space-y-3">
          {snapshot.recentActivity.map(log => (
            <div key={log.id} className="flex items-start gap-3 text-sm">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${log.action === 'insert' ? 'bg-green-900/50 text-green-400' : log.action === 'delete' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                {log.action === 'insert' ? <Plus size={12} /> : log.action === 'delete' ? <Trash2 size={12} /> : <Edit2 size={12} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium">{log.action === 'insert' ? 'Registro creado' : log.action === 'delete' ? 'Registro eliminado' : 'Registro actualizado'}</div>
                <div className="text-[#64748b] text-xs truncate">{log.table_name} · {log.user_email ?? 'Sistema'}</div>
              </div>
              <div className="text-[#64748b] text-xs flex-shrink-0">{formatDate(log.created_at, true)}</div>
            </div>
          ))}
          {snapshot.recentActivity.length === 0 && <AdminEmpty message="No hay actividad reciente visible." compact />}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADMIN INVENTORY
// ─────────────────────────────────────────────
function AdminInventory({ onAdd }: { onAdd: () => void }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<InventorySort>('internal_code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<InventoryProduct[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const perPage = 10
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void getInventoryPage({ search, sort: sortKey, ascending: sortDir === 'asc', page, pageSize: perPage })
        .then(result => {
          if (!active) return
          setRows(result.rows)
          setTotalCount(result.count)
        })
        .catch(() => {
          if (active) setError('No fue posible cargar el inventario desde Supabase.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, search, sortDir, sortKey])

  const handleSort = (k: InventorySort) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc'); setPage(0) }
  }

  const SortIcon = ({ k }: { k: InventorySort }) => (
    sortKey === k
      ? sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
      : <div className="w-3" />
  )

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const products = await getInventoryExport()
      downloadCsv('inventario-bahia-nacho.csv', [
        ['Código', 'OEM', 'Producto', 'Marca', 'Categoría', 'Stock', 'Disponible', 'Mínimo', 'Precio', 'Moneda', 'Estado'],
        ...products.map(product => [
          product.internalCode,
          product.oemCode ?? '',
          product.name,
          product.brandName,
          product.categoryName,
          product.stock,
          product.availableStock,
          product.minStock,
          product.salePrice,
          product.currencyCode,
          product.status,
        ]),
      ])
    } catch {
      setError('No fue posible exportar el inventario.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Buscar producto…"
            className="w-full glass border border-[#1e3a5f] focus:border-[#1565ff] bg-transparent pl-9 pr-3 py-2 text-white placeholder-[#64748b] rounded-lg text-sm outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={onAdd} className="flex items-center gap-2 bg-[#1565ff] hover:bg-[#1252d3] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all glow-blue">
            <Plus size={15} /> Agregar
          </button>
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 glass border border-[#1e3a5f] hover:border-[#1565ff] disabled:opacity-50 text-[#93c5fd] text-sm px-3 py-2 rounded-lg transition-all">
            {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />} Exportar
          </button>
        </div>
      </div>

      {error && <AdminError message={error} />}

      <div className="glass border border-[#1e3a5f] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0a1628]">
                {([['internal_code', 'Código'], ['name', 'Producto'], ['brand_name', 'Marca'], ['category_name', 'Categoría'], ['stock', 'Stock'], ['sale_price', 'Precio'], ['', 'Estado']] as Array<[InventorySort | '', string]>).map(([k, l]) => (
                  <th key={l} className="px-4 py-3 text-left text-xs text-[#64748b] font-medium">
                    {k ? (
                      <button className="flex items-center gap-1 hover:text-white transition-colors" onClick={() => handleSort(k)}>
                        {l} <SortIcon k={k} />
                      </button>
                    ) : l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="table-row-hover border-b border-[#1e3a5f]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-[#00b4d8]">{p.internalCode}</div>
                    <div className="text-[#64748b] text-xs">{p.oemCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.primaryImageUrl ? (
                        <img src={p.primaryImageUrl} alt="" className="w-9 h-9 rounded-lg object-cover bg-[#0a1628] flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#0a1628] flex items-center justify-center flex-shrink-0"><Package size={14} className="text-[#64748b]" /></div>
                      )}
                      <div className="min-w-0">
                        <div className="text-white text-xs font-medium truncate max-w-[200px]">{p.name}</div>
                        <div className="text-[#64748b] text-xs truncate max-w-[200px]">Disponible: {p.availableStock}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#93c5fd] text-xs">{p.brandName}</td>
                  <td className="px-4 py-3 text-[#64748b] text-xs">{p.categoryName}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-white font-medium text-xs">{p.stock}</div>
                    <div className="text-[#64748b] text-xs">mín: {p.minStock}</div>
                  </td>
                  <td className="px-4 py-3 font-display font-bold text-white text-sm">{formatCurrency(p.salePrice, p.currencyCode)}</td>
                  <td className="px-4 py-3"><StockBadge stock={p.stock} min={p.minStock} /></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7}><AdminEmpty message="No hay productos que coincidan con la búsqueda." /></td></tr>
              )}
              {loading && (
                <tr><td colSpan={7}><AdminLoading message="Consultando inventario…" compact /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e3a5f] text-xs text-[#64748b]">
          <span>Mostrando {rows.length} de {totalCount} resultados</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`w-6 h-6 rounded-lg text-xs transition-all ${page === i ? 'bg-[#1565ff] text-white' : 'hover:bg-white/5 text-[#64748b]'}`}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || totalCount === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminAudit() {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AuditEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void getAuditPage({ search, page, pageSize })
        .then(result => {
          if (!active) return
          setRows(result.rows)
          setTotalCount(result.count)
        })
        .catch(() => {
          if (active) setError('No fue posible consultar la auditoría.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, search])

  const exportCurrentPage = () => {
    downloadCsv('auditoria-bahia-nacho.csv', [
      ['ID', 'Acción', 'Tabla', 'Registro', 'Campos', 'Usuario', 'IP', 'Fecha'],
      ...rows.map(row => [
        row.id,
        row.action,
        row.tableName,
        row.recordId ?? '',
        row.changedFields.join(', '),
        row.userEmail ?? 'Sistema',
        row.ipAddress ?? '',
        row.createdAt,
      ]),
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
          <input
            type="search"
            value={search}
            onChange={event => { setSearch(event.target.value); setPage(0) }}
            maxLength={80}
            placeholder="Filtrar por tabla, acción o registro…"
            className="w-full glass border border-[#1e3a5f] focus:border-[#1565ff] bg-transparent pl-9 pr-3 py-2 text-white placeholder-[#64748b] rounded-lg text-sm outline-none"
          />
        </div>
        <button onClick={exportCurrentPage} disabled={rows.length === 0} className="flex items-center gap-2 glass border border-[#1e3a5f] hover:border-[#1565ff] disabled:opacity-40 text-[#93c5fd] text-sm px-3 py-2 rounded-lg transition-all">
          <Download size={14} /> Exportar página
        </button>
      </div>

      {error && <AdminError message={error} />}

      <div className="glass border border-[#1e3a5f] rounded-xl overflow-hidden">
        {loading ? <AdminLoading message="Consultando auditoría…" compact /> : rows.length === 0 ? (
          <AdminEmpty message="No hay registros de auditoría para este filtro." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a1628] border-b border-[#1e3a5f]">
                  {['Tipo', 'Usuario', 'Entidad', 'Cambios', 'IP', 'Fecha y hora'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs text-[#64748b] font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(log => (
                  <tr key={log.id} className="table-row-hover border-b border-[#1e3a5f]/50 transition-colors">
                    <td className="px-4 py-3"><AuditActionBadge action={log.action} /></td>
                    <td className="px-4 py-3 text-[#93c5fd] text-xs">{log.userEmail ?? 'Sistema'}</td>
                    <td className="px-4 py-3">
                      <div className="text-white text-xs font-medium">{log.tableName}</div>
                      <div className="text-[#64748b] text-xs font-mono max-w-36 truncate">{log.recordId ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-[#64748b] text-xs max-w-xs">
                      {log.changedFields.length > 0 ? log.changedFields.join(', ') : 'Registro completo'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{log.ipAddress ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{formatDate(log.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e3a5f] text-xs text-[#64748b]">
          <span>{totalCount} registros</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            <span>Página {page + 1} de {totalPages}</span>
            <button onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1 || totalCount === 0} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
function AdminNotifications({ onCountChange }: { onCountChange: (count: number) => void }) {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAlerts(await getInventoryAlerts())
    } catch {
      setError('No fue posible consultar las alertas de inventario.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAlerts()
  }, [loadAlerts])

  const visibleAlerts = alerts.filter(alert => !dismissed.has(alert.productId))

  useEffect(() => {
    onCountChange(visibleAlerts.length)
  }, [onCountChange, visibleAlerts.length])

  const dismissAll = () => {
    setDismissed(new Set(alerts.map(alert => alert.productId)))
    onCountChange(0)
  }

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[#64748b] text-sm">{visibleAlerts.length} alertas activas</div>
        <div className="flex gap-3">
          <button onClick={loadAlerts} disabled={loading} className="text-[#93c5fd] hover:text-white text-sm transition-colors disabled:opacity-50">Actualizar</button>
          <button onClick={dismissAll} disabled={visibleAlerts.length === 0} className="text-[#1565ff] hover:text-[#00b4d8] text-sm transition-colors disabled:opacity-40">Ocultar esta sesión</button>
        </div>
      </div>

      {error && <AdminError message={error} onRetry={loadAlerts} />}
      {loading ? <AdminLoading message="Consultando alertas reales…" /> : visibleAlerts.length === 0 ? (
        <AdminEmpty message="No hay productos agotados ni por debajo del stock mínimo." />
      ) : visibleAlerts.map(alert => {
        const outOfStock = alert.alertType === 'out_of_stock'
        return (
          <div key={alert.productId} className="glass border border-[#1e3a5f] rounded-xl p-4 flex gap-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${outOfStock ? 'text-red-400 bg-red-900/30 border-red-800' : 'text-yellow-400 bg-yellow-900/30 border-yellow-800'}`}>
              <AlertTriangle size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-white text-sm">{outOfStock ? 'Producto agotado' : 'Stock bajo'}</div>
                <div className="w-2 h-2 rounded-full bg-[#1565ff] flex-shrink-0 mt-1.5 badge-pulse" />
              </div>
              <p className="text-[#93c5fd] text-xs mt-0.5 leading-relaxed">
                {alert.internalCode} · {alert.productName} — {alert.stock} unidades (mínimo: {alert.minStock})
              </p>
              <div className="text-[#64748b] text-xs mt-1">Producto actualizado {formatDate(alert.updatedAt, true)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
function AdminPlaceholder({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 glass border border-[#1e3a5f] rounded-xl text-center">
      <Icon size={40} className="text-[#1565ff]/40 mb-3" />
      <p className="text-white font-semibold">{title}</p>
      <p className="text-[#64748b] text-sm mt-1 max-w-md px-4">La base de datos y sus políticas ya están preparadas. La interfaz CRUD de este módulo será la siguiente fase.</p>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADMIN PANEL WRAPPER
// ─────────────────────────────────────────────
function AdminPanel({
  onPublic,
  onCatalogChanged,
}: {
  onPublic: () => void
  onCatalogChanged: () => Promise<void> | void
}) {
  const { profile, signOut } = useAuth()
  const [adminView, setAdminView] = useState<AdminView>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [notifCount, setNotifCount] = useState(0)

  const refreshAlertCount = useCallback(async () => {
    try {
      setNotifCount((await getInventoryAlerts(200)).length)
    } catch {
      setNotifCount(0)
    }
  }, [])

  useEffect(() => {
    void refreshAlertCount()
    const interval = window.setInterval(() => void refreshAlertCount(), 60_000)
    return () => window.clearInterval(interval)
  }, [refreshAlertCount])

  const handleSignOut = () => {
    void signOut().finally(onPublic)
  }

  if (!profile) return <AdminLoading message="Validando perfil autorizado…" />

  const adminTitles: Record<AdminView, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Resumen general de la operación' },
    inventory: { title: 'Inventario', subtitle: 'Gestión completa de stock y productos' },
    products: { title: 'Productos', subtitle: 'Crear, editar y gestionar el catálogo' },
    categories: { title: 'Categorías', subtitle: 'Organización del catálogo por categorías' },
    brands: { title: 'Marcas', subtitle: 'Gestión de marcas comercializadas' },
    suppliers: { title: 'Proveedores', subtitle: 'Base de datos de proveedores' },
    clients: { title: 'Clientes', subtitle: 'Registro y gestión de clientes' },
    users: { title: 'Usuarios', subtitle: 'Roles, estado y control de acceso' },
    orders: { title: 'Órdenes', subtitle: 'Seguimiento de pedidos y consultas' },
    import: { title: 'Importar Excel', subtitle: 'Actualización masiva de inventario' },
    reports: { title: 'Reportes', subtitle: 'Análisis y reportes de gestión' },
    audit: { title: 'Auditoría', subtitle: 'Registro de modificaciones del sistema' },
    notifications: { title: 'Notificaciones', subtitle: 'Centro de alertas y avisos del sistema' },
    settings: { title: 'Configuración', subtitle: 'Ajustes del sistema y preferencias' },
  }

  const { title, subtitle } = adminTitles[adminView]

  return (
    <div className="min-h-screen bg-[#060d1a] flex">
      <AdminSidebar current={adminView} onNav={setAdminView} onPublic={onPublic} onSignOut={handleSignOut} permissions={profile.permissions} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <AdminTopbar title={title} subtitle={subtitle} notifications={notifCount} profile={profile} onNotifications={() => setAdminView('notifications')} />
        <main className="flex-1 p-6 overflow-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] mb-5">
            <span>Bahía Nacho</span>
            <ChevronRight size={12} />
            <span className="text-[#93c5fd]">{title}</span>
          </div>

          {adminView === 'dashboard' && <AdminDashboard onAudit={() => setAdminView('audit')} />}
          {adminView === 'inventory' && <AdminInventory onAdd={() => setAdminView('products')} />}
          {adminView === 'import' && (
            <InventoryImportPanel
              canImport={profile.permissions.includes('imports.manage')}
              onImported={onCatalogChanged}
            />
          )}
          {adminView === 'audit' && <AdminAudit />}
          {adminView === 'notifications' && <AdminNotifications onCountChange={setNotifCount} />}
          {adminView === 'users' && <UserManagement currentUser={profile} />}
          {adminView === 'products' && (
            <ProductImageManager
              canManage={profile.permissions.includes('products.manage')}
              canManageStock={profile.permissions.includes('inventory.manage')}
              onCatalogChanged={onCatalogChanged}
            />
          )}
          {adminView === 'categories' && <AdminPlaceholder title="Gestión de Categorías" icon={Tag} />}
          {adminView === 'brands' && <AdminPlaceholder title="Gestión de Marcas" icon={Award} />}
          {adminView === 'suppliers' && <AdminPlaceholder title="Gestión de Proveedores" icon={Truck} />}
          {adminView === 'clients' && <AdminPlaceholder title="Gestión de Clientes" icon={Users} />}
          {adminView === 'orders' && <AdminPlaceholder title="Gestión de Órdenes" icon={ShoppingCart} />}
          {adminView === 'reports' && <AdminPlaceholder title="Reportes y Analítica" icon={BarChart3} />}
          {adminView === 'settings' && <AdminPlaceholder title="Configuración del Sistema" icon={Settings} />}
        </main>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// HOME PAGE (assembled)
// ─────────────────────────────────────────────
function HomePage({
  products,
  catalogLoading,
  catalogError,
  onCatalogRetry,
  onSearch,
  onDetail,
  onCatalog,
}: {
  products: Product[]
  catalogLoading: boolean
  catalogError: string | null
  onCatalogRetry: () => void
  onSearch: (q: string) => void
  onDetail: (p: Product) => void
  onCatalog: () => void
}) {
  const brands = useMemo(
    () => Array.from(new Set(products.map(product => product.brand))).sort((a, b) => a.localeCompare(b, 'es')),
    [products],
  )

  return (
    <>
      <HeroSection onSearch={onSearch} />
      <FeaturedSection
        products={products}
        loading={catalogLoading}
        error={catalogError}
        onRetry={onCatalogRetry}
        onDetail={onDetail}
        onCatalog={onCatalog}
      />
      <BrandsSection brands={brands} />
      <ServicesSection />
      <FAQSection />
      <TestimonialsSection />
      <LocationSection />
    </>
  )
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const { session, profile, loading: authLoading, authError, signOut } = useAuth()
  const [view, setView] = useState<View>('home')
  const [products, setProducts] = useState<Product[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [navSection, setNavSection] = useState('inicio')

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)

    try {
      const nextProducts = await getPublicCatalog()
      setProducts(nextProducts)
      setSelectedProduct(current =>
        current ? nextProducts.find(product => product.id === current.id) ?? current : null,
      )
    } catch {
      setCatalogError('No fue posible cargar el catálogo desde Supabase.')
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const goToProduct = (p: Product) => {
    setSelectedProduct(p)
    setView('product')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToCatalog = (q = '') => {
    setCatalogQuery(q)
    setView('catalog')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNav = (section: string) => {
    const s = section.toLowerCase()
    setNavSection(s)
    if (s === 'inicio') { setView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    else if (s === 'catálogo' || s === 'motores' || s === 'repuestos' || s === 'accesorios') goToCatalog()
    else setView('home')
  }

  const returnToPublic = () => {
    setView('home')
    window.scrollTo({ top: 0 })
  }

  if (view === 'account') {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
          <AdminLoading message="Validando sesión segura…" />
        </div>
      )
    }

    if (!session) return <LoginPage onBack={returnToPublic} />

    if (authError || !profile) {
      return (
        <div className="min-h-screen bg-[#060d1a] flex items-center justify-center px-4">
          <div className="glass border border-red-800/60 rounded-2xl p-7 max-w-lg text-center">
            <AlertTriangle size={36} className="mx-auto text-red-400 mb-3" />
            <h1 className="font-display text-2xl font-bold text-white">Acceso no disponible</h1>
            <p className="text-[#93c5fd] text-sm mt-2">{authError ?? 'No existe un perfil autorizado para esta sesión.'}</p>
            <div className="flex justify-center gap-3 mt-5">
              <button onClick={returnToPublic} className="glass border border-[#1e3a5f] text-[#93c5fd] px-4 py-2 rounded-lg text-sm">Volver al sitio</button>
              <button onClick={() => void signOut()} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Cerrar sesión</button>
            </div>
          </div>
        </div>
      )
    }

    if (profile.role.code === 'customer') {
      return (
        <CustomerPortal
          profile={profile}
          onCatalog={() => goToCatalog()}
          onPublic={returnToPublic}
          onSignOut={() => { void signOut().finally(returnToPublic) }}
        />
      )
    }

    return <AdminPanel onPublic={returnToPublic} onCatalogChanged={loadCatalog} />
  }

  return (
    <div className="min-h-screen bg-[#060d1a]">
      <PublicNavbar
        onAccountClick={() => setView('account')}
        accountLabel={!session ? 'Iniciar sesión' : profile?.role.code === 'customer' ? 'Mi cuenta' : 'Panel de gestión'}
        currentSection={navSection}
        onNav={handleNav}
      />

      {view === 'home' && (
        <HomePage
          products={products}
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          onCatalogRetry={() => void loadCatalog()}
          onSearch={q => goToCatalog(q)}
          onDetail={goToProduct}
          onCatalog={() => goToCatalog()}
        />
      )}
      {view === 'catalog' && (
        <CatalogPage
          products={products}
          loading={catalogLoading}
          error={catalogError}
          onRetry={() => void loadCatalog()}
          onDetail={goToProduct}
          initialQuery={catalogQuery}
        />
      )}
      {view === 'product' && selectedProduct && (
        <ProductDetailPage
          product={selectedProduct}
          products={products}
          onDetail={goToProduct}
          onBack={() => { setView('catalog'); window.scrollTo({ top: 0 }) }}
        />
      )}

      <Footer onNav={handleNav} />
    </div>
  )
}
