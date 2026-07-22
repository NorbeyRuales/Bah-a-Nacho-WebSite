import { useState, useEffect, useRef } from 'react'
import {
  Search, Menu, X, ChevronDown, ChevronRight, Star, Phone, Mail, MapPin,
  Clock, Anchor, Zap, Shield, Truck, Wrench,
  ChevronLeft, Filter, SlidersHorizontal, MessageCircle, Heart, Share2,
  LayoutDashboard, Package, Tag, Building2, Users, ShoppingCart, Upload,
  FileSpreadsheet, BarChart3, Settings, Bell, LogOut, Plus, Edit2, Trash2,
  Eye, Copy, Download, RefreshCw, AlertTriangle, CheckCircle, Info, TrendingUp,
  TrendingDown, ArrowUpRight, ArrowDownRight, FileText, Database, History,
  ChevronUp, MoreVertical, Grid, List, Bookmark, Award, Navigation,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import logoImg from './imports/image.png'

// ─────────────────────────────────────────────
// TYPES & DATA
// ─────────────────────────────────────────────
type Product = {
  id: string
  code: string
  oemCode: string
  name: string
  category: string
  brand: string
  compatibility: string[]
  price: number
  stock: number
  minStock: number
  image: string
  images: string[]
  description: string
  specs: Record<string, string>
  available: boolean
  featured: boolean
  weight: string
  location: string
}

type View = 'home' | 'catalog' | 'product' | 'admin'
type AdminView =
  | 'dashboard' | 'inventory' | 'products' | 'categories' | 'brands'
  | 'suppliers' | 'clients' | 'orders' | 'import' | 'reports' | 'audit'
  | 'notifications' | 'settings'

const BRANDS = ['Yamaha', 'Mercury', 'Suzuki', 'Honda', 'Tohatsu', 'Evinrude', 'Johnson', 'BRP']
const CATEGORIES = ['Repuestos de Motor', 'Hélices', 'Sistemas de Combustible', 'Refrigeración', 'Eléctrico', 'Accesorios', 'Motores Completos', 'Lubricantes']

const PRODUCTS: Product[] = [
  {
    id: '1', code: 'BN-001', oemCode: '6H3-44352-00-00',
    name: 'Impeller Kit de Agua - Yamaha 40-60 HP',
    category: 'Refrigeración', brand: 'Yamaha',
    compatibility: ['Yamaha 40 HP', 'Yamaha 50 HP', 'Yamaha 60 HP', 'Yamaha 70 HP'],
    price: 48.50, stock: 32, minStock: 5,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop&auto=format',
    ],
    description: 'Kit completo de impeller para bomba de agua. Fabricado con caucho de alta calidad resistente al agua salada. Incluye impeller, plato de desgaste, junta y plato de aletas.',
    specs: { Material: 'Caucho EPDM', Diámetro: '65mm', Aletas: '6', Temperatura: '-40°C a 120°C' },
    available: true, featured: true, weight: '0.35 kg', location: 'A-12-3',
  },
  {
    id: '2', code: 'BN-002', oemCode: '8M0100526',
    name: 'Hélice Acero Inox Mercury 13.5x17 - 3 Palas',
    category: 'Hélices', brand: 'Mercury',
    compatibility: ['Mercury 75 HP', 'Mercury 90 HP', 'Mercury 115 HP'],
    price: 285.00, stock: 8, minStock: 3,
    image: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400&h=300&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&h=600&fit=crop&auto=format',
    ],
    description: 'Hélice de acero inoxidable de 3 palas, diseño cupping para máximo rendimiento. Acabado pulido de alta precisión. Reduce la cavitación y mejora la aceleración.',
    specs: { Material: 'Acero Inox 316', Diámetro: '13.5"', Paso: '17"', Palas: '3', Buje: 'Estándar' },
    available: true, featured: true, weight: '2.8 kg', location: 'B-05-1',
  },
  {
    id: '3', code: 'BN-003', oemCode: '65W-14301-00-00',
    name: 'Carburador Completo Yamaha 25-30 HP',
    category: 'Sistemas de Combustible', brand: 'Yamaha',
    compatibility: ['Yamaha 25 HP', 'Yamaha 30 HP', 'Yamaha 25 HP 2T'],
    price: 132.00, stock: 4, minStock: 5,
    image: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=400&h=300&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=800&h=600&fit=crop&auto=format',
    ],
    description: 'Carburador original de reemplazo con todos los jets y juntas incluidos. Compatible con motores fuera de borda Yamaha de 2 tiempos. Garantiza mezcla óptima de combustible.',
    specs: { Tipo: '2 Tiempos', Jets: 'Incluidos', Juntas: 'Incluidas', Garantía: '12 meses' },
    available: true, featured: false, weight: '1.2 kg', location: 'C-08-2',
  },
  {
    id: '4', code: 'BN-004', oemCode: 'DF-15-FuelPump',
    name: 'Bomba de Combustible Suzuki DF15A-DF20A',
    category: 'Sistemas de Combustible', brand: 'Suzuki',
    compatibility: ['Suzuki DF15A', 'Suzuki DF20A'],
    price: 74.00, stock: 12, minStock: 5,
    image: 'https://images.unsplash.com/photo-1609765948700-5acad1e09f03?w=400&h=300&fit=crop&auto=format',
    images: [],
    description: 'Bomba de combustible de alta calidad para motores Suzuki 4 tiempos. Fabricada con materiales resistentes a la gasolina y al ambiente marino salino.',
    specs: { Caudal: '24 L/h', Presión: '0.35 bar', Voltaje: '12V DC', Corriente: '2.5A' },
    available: true, featured: false, weight: '0.45 kg', location: 'C-04-7',
  },
  {
    id: '5', code: 'BN-005', oemCode: 'HON-BF50-PROP',
    name: 'Hélice Aluminio Honda BF50 14x19 - 3 Palas',
    category: 'Hélices', brand: 'Honda',
    compatibility: ['Honda BF40', 'Honda BF50', 'Honda BF60'],
    price: 145.00, stock: 6, minStock: 3,
    image: 'https://images.unsplash.com/photo-1598300056393-4aac492f4344?w=400&h=300&fit=crop&auto=format',
    images: [],
    description: 'Hélice de aluminio de alta resistencia. Diseño optimizado para motores Honda de mediana potencia. Excelente relación calidad-precio.',
    specs: { Material: 'Aluminio A356', Diámetro: '14"', Paso: '19"', Palas: '3' },
    available: true, featured: true, weight: '1.9 kg', location: 'B-06-4',
  },
  {
    id: '6', code: 'BN-006', oemCode: 'TOH-M18-STARTERKIT',
    name: 'Kit Arranque Eléctrico Tohatsu MFS 9.9-18 HP',
    category: 'Eléctrico', brand: 'Tohatsu',
    compatibility: ['Tohatsu MFS9.9', 'Tohatsu MFS15', 'Tohatsu MFS18'],
    price: 218.00, stock: 0, minStock: 2,
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop&auto=format',
    images: [],
    description: 'Kit completo de arranque eléctrico para conversión de motores con arranque manual. Incluye motor de arranque, bobina de carga, regulador de voltaje y cableado.',
    specs: { Voltaje: '12V', Potencia: '0.8 kW', Incluye: 'Motor + Bobina + Regulador' },
    available: false, featured: false, weight: '3.2 kg', location: 'D-02-1',
  },
  {
    id: '7', code: 'BN-007', oemCode: 'YAM-F150-COMPLETE',
    name: 'Motor Yamaha F150 AETX 150 HP 4T Completo',
    category: 'Motores Completos', brand: 'Yamaha',
    compatibility: ['Universal - Mástil 20"', 'Universal - Mástil 25"'],
    price: 14800.00, stock: 2, minStock: 1,
    image: 'https://images.unsplash.com/photo-1562603812-0e07164a2959?w=400&h=300&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1562603812-0e07164a2959?w=800&h=600&fit=crop&auto=format',
    ],
    description: 'Motor fuera de borda Yamaha F150 AETX de 4 tiempos. El estándar de la industria en confiabilidad y rendimiento. Incluye mando a distancia, cables de control y acelerador.',
    specs: { Tipo: '4 Tiempos', HP: '150', Cilindros: '4 en línea', Desplazamiento: '2670cc', Peso: '222 kg', Arranque: 'Eléctrico' },
    available: true, featured: true, weight: '222 kg', location: 'E-01-1',
  },
  {
    id: '8', code: 'BN-008', oemCode: 'MER-TRIM-TAB-16',
    name: 'Ánodo de Zinc Mercury/Mercruiser - Kit Completo',
    category: 'Accesorios', brand: 'Mercury',
    compatibility: ['Mercury 40-300 HP', 'Mercruiser Alpha', 'Mercruiser Bravo'],
    price: 38.00, stock: 45, minStock: 10,
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=300&fit=crop&auto=format',
    images: [],
    description: 'Kit completo de ánodos de zinc para protección catódica. Protege contra corrosión electrolítica en ambientes marinos. Recomendado para agua salada y salobre.',
    specs: { Material: 'Zinc de Alta Pureza', Piezas: '4 ánodos', Ambientes: 'Agua salada/salobre' },
    available: true, featured: false, weight: '0.8 kg', location: 'F-11-5',
  },
]

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
  { q: '¿Cómo sé si el repuesto es compatible con mi motor?', a: 'Puedes buscar por código OEM, modelo de motor, año o potencia. Nuestro equipo técnico también está disponible vía WhatsApp para asesorarte en la selección correcta.' },
  { q: '¿Tienen servicio de envío a todo el país?', a: 'Sí, realizamos envíos a todo el territorio nacional mediante operadores de carga especializados. El tiempo de entrega varía entre 1-3 días hábiles según la ciudad destino.' },
  { q: '¿Cuál es la garantía de los productos?', a: 'Los repuestos originales tienen garantía de fábrica (6-24 meses según fabricante). Los productos alternativos cuentan con 6 meses de garantía por defectos de fabricación.' },
  { q: '¿Ofrecen crédito o financiamiento?', a: 'Sí, manejamos crédito para clientes frecuentes con historial de compra. Contáctenos para conocer los requisitos y condiciones del crédito empresarial.' },
  { q: '¿Tienen taller de reparación de motores?', a: 'Contamos con taller especializado para diagnóstico y reparación de motores Yamaha, Mercury, Suzuki y Honda. Solicite su cita vía WhatsApp.' },
]

// ─────────────────────────────────────────────
// ADMIN DATA
// ─────────────────────────────────────────────
const inventoryChartData = [
  { month: 'Ene', entradas: 145, salidas: 98, stock: 412 },
  { month: 'Feb', entradas: 120, salidas: 110, stock: 422 },
  { month: 'Mar', entradas: 200, salidas: 145, stock: 477 },
  { month: 'Abr', entradas: 180, salidas: 160, stock: 497 },
  { month: 'May', entradas: 95, salidas: 185, stock: 407 },
  { month: 'Jun', entradas: 240, salidas: 130, stock: 517 },
  { month: 'Jul', entradas: 165, salidas: 148, stock: 534 },
]

const salesByCategory = [
  { name: 'Refrigeración', value: 34 },
  { name: 'Hélices', value: 28 },
  { name: 'Combustible', value: 18 },
  { name: 'Eléctrico', value: 12 },
  { name: 'Accesorios', value: 8 },
]

const PIE_COLORS = ['#1565ff', '#00b4d8', '#0ea5e9', '#38bdf8', '#7dd3fc']

const AUDIT_LOG = [
  { id: 1, user: 'admin@bahianacho.com', action: 'Actualización de precio', detail: 'BN-002 Hélice Mercury: $265 → $285', date: '2026-07-20 14:32', type: 'edit' },
  { id: 2, user: 'inventario@bahianacho.com', action: 'Entrada de stock', detail: 'BN-001 Impeller Yamaha: +20 unidades', date: '2026-07-20 12:15', type: 'add' },
  { id: 3, user: 'admin@bahianacho.com', action: 'Importación Excel', detail: '48 productos actualizados desde inventario_julio.xlsx', date: '2026-07-20 10:00', type: 'import' },
  { id: 4, user: 'ventas@bahianacho.com', action: 'Producto creado', detail: 'BN-009 Kit Filtro Combustible Honda BF creado', date: '2026-07-19 16:45', type: 'add' },
  { id: 5, user: 'admin@bahianacho.com', action: 'Eliminación de categoría', detail: 'Categoría "Descontinuados" eliminada (0 productos)', date: '2026-07-19 11:20', type: 'delete' },
  { id: 6, user: 'inventario@bahianacho.com', action: 'Ajuste de inventario', detail: 'BN-006 Kit Arranque Tohatsu: 3 → 0 (agotado)', date: '2026-07-18 17:00', type: 'edit' },
  { id: 7, user: 'admin@bahianacho.com', action: 'Configuración actualizada', detail: 'Stock mínimo actualizado para 12 productos', date: '2026-07-18 09:30', type: 'settings' },
]

const NOTIFICATIONS_DATA = [
  { id: 1, type: 'warning', title: 'Stock Bajo', message: 'BN-003 Carburador Yamaha 25-30 HP — 4 unidades (mínimo: 5)', time: 'Hace 5 min', read: false },
  { id: 2, type: 'error', title: 'Producto Agotado', message: 'BN-006 Kit Arranque Eléctrico Tohatsu — Sin stock', time: 'Hace 2 horas', read: false },
  { id: 3, type: 'success', title: 'Importación Exitosa', message: '48 productos actualizados desde inventario_julio.xlsx', time: 'Hace 4 horas', read: false },
  { id: 4, type: 'info', title: 'Nueva Consulta WhatsApp', message: 'Cliente pregunta por hélices Mercury 90 HP paso 19', time: 'Hace 6 horas', read: true },
  { id: 5, type: 'warning', title: 'Stock Bajo', message: 'BN-002 Hélice Mercury 13.5x17 — 8 unidades (mínimo: 3)', time: 'Ayer', read: true },
  { id: 6, type: 'success', title: 'Respaldo Completado', message: 'Base de datos respaldada exitosamente (2.4 GB)', time: 'Ayer', read: true },
]

// ─────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────
function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price)
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
function PublicNavbar({ onAdminClick, currentSection, onNav }: {
  onAdminClick: () => void
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
          <button onClick={onAdminClick} className="bg-[#1565ff] hover:bg-[#1252d3] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 glow-blue">
            Panel Admin
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
            <button onClick={onAdminClick} className="mt-2 bg-[#1565ff] text-white py-2 rounded-lg text-sm font-semibold">
              Panel Admin
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
                placeholder="Buscar por nombre, código OEM, referencia o modelo…"
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
          onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060d1a]/60 to-transparent" />
        <div className="absolute top-3 left-3">
          <StockBadge stock={product.stock} min={product.minStock} />
        </div>
        {product.featured && (
          <div className="absolute top-3 right-3 bg-[#1565ff] text-white text-xs px-2 py-0.5 rounded-full font-semibold">
            Destacado
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="font-mono text-xs text-[#64748b] mb-1">{product.code} · {product.oemCode}</div>
        <h3 className="font-semibold text-white text-sm leading-snug mb-2 line-clamp-2">{product.name}</h3>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="bg-[#0a2a5e] text-[#93c5fd] text-xs px-2 py-0.5 rounded-full">{product.brand}</span>
          <span className="bg-[#0a2a5e] text-[#93c5fd] text-xs px-2 py-0.5 rounded-full">{product.category}</span>
        </div>
        <div className="text-xs text-[#64748b] mb-3 line-clamp-1">
          Compatible: {product.compatibility.slice(0, 2).join(', ')}{product.compatibility.length > 2 && ' +más'}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-bold text-white">{formatPrice(product.price)}</span>
          <WhatsAppBtn text={`Hola, me interesa el producto: ${product.name} (${product.code})`} small />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// CATALOG PAGE
// ─────────────────────────────────────────────
function CatalogPage({ onDetail, initialQuery }: { onDetail: (p: Product) => void; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [availability, setAvailability] = useState<'all' | 'available' | 'low'>('all')
  const [priceMax, setPriceMax] = useState(20000)
  const [showFilters, setShowFilters] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filtered = PRODUCTS.filter(p => {
    const q = query.toLowerCase()
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.oemCode.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.compatibility.some(c => c.toLowerCase().includes(q))
    const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(p.brand)
    const matchCat = selectedCats.length === 0 || selectedCats.includes(p.category)
    const matchAvail = availability === 'all' || (availability === 'available' && p.stock > 0) || (availability === 'low' && p.stock <= p.minStock && p.stock > 0)
    const matchPrice = p.price <= priceMax
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
            placeholder="Buscar por nombre, código, referencia o modelo…"
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
                  {BRANDS.map(b => (
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
                  {CATEGORIES.map(c => (
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
                  {[['all', 'Todos'], ['available', 'En stock'], ['low', 'Stock bajo']].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" name="avail" value={v} checked={availability === v} onChange={() => setAvailability(v as 'all' | 'available' | 'low')} className="accent-[#1565ff]" />
                      <span className="text-sm text-[#93c5fd] group-hover:text-white transition-colors">{l}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="glass border border-[#1e3a5f] rounded-xl p-4">
                <h3 className="font-semibold text-white text-sm mb-3">Precio máximo</h3>
                <input type="range" min={0} max={20000} step={100} value={priceMax} onChange={e => setPriceMax(+e.target.value)} className="w-full accent-[#1565ff]" />
                <div className="text-[#00b4d8] text-sm mt-1 font-mono">{formatPrice(priceMax)}</div>
              </div>

              <button onClick={() => { setSelectedBrands([]); setSelectedCats([]); setAvailability('all'); setPriceMax(20000) }}
                className="w-full text-center text-sm text-[#64748b] hover:text-[#1565ff] transition-colors">
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Products grid */}
          <div className="flex-1">
            {filtered.length === 0 ? (
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
        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80&h=80&fit=crop' }} />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-[#64748b] mb-0.5">{product.code} · {product.oemCode}</div>
        <h3 className="font-semibold text-white text-sm mb-1">{product.name}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#0a2a5e] text-[#93c5fd] text-xs px-2 py-0.5 rounded-full">{product.brand}</span>
          <StockBadge stock={product.stock} min={product.minStock} />
          <span className="text-[#64748b] text-xs">{product.compatibility.slice(0, 2).join(', ')}</span>
        </div>
      </div>
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <span className="font-display text-xl font-bold text-white">{formatPrice(product.price)}</span>
        <WhatsAppBtn text={`Consulta: ${product.name} (${product.code})`} small />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PRODUCT DETAIL PAGE
// ─────────────────────────────────────────────
function ProductDetailPage({ product, onBack }: { product: Product; onBack: () => void }) {
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
                onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop' }} />
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
              Código: <span className="text-[#00b4d8]">{product.code}</span> · OEM: <span className="text-[#00b4d8]">{product.oemCode}</span>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <span className="font-display text-4xl font-bold text-white">{formatPrice(product.price)}</span>
              <StockBadge stock={product.stock} min={product.minStock} />
            </div>

            <p className="text-[#93c5fd] leading-relaxed mb-6">{product.description}</p>

            {/* Compatibility */}
            <div className="glass border border-[#1e3a5f] rounded-xl p-4 mb-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><CheckCircle size={14} className="text-[#00b4d8]" /> Compatibilidad</h3>
              <div className="flex flex-wrap gap-2">
                {product.compatibility.map(c => (
                  <span key={c} className="bg-[#0a2a5e] text-[#93c5fd] text-xs px-3 py-1 rounded-full border border-[#1e3a5f]">{c}</span>
                ))}
              </div>
            </div>

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
                <div className="flex justify-between text-xs border-b border-[#1e3a5f] pb-1">
                  <span className="text-[#64748b]">Peso</span>
                  <span className="text-white font-medium">{product.weight}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-[#1e3a5f] pb-1">
                  <span className="text-[#64748b]">Stock</span>
                  <span className="text-white font-medium font-mono">{product.stock} uds.</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <WhatsAppBtn text={`Hola! Quiero consultar sobre: ${product.name}\nCódigo: ${product.code}\nOEM: ${product.oemCode}`} />
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
            {PRODUCTS.filter(p => p.id !== product.id && p.brand === product.brand).slice(0, 4).map(p => (
              <ProductCard key={p.id} product={p} onDetail={() => {}} />
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
function FeaturedSection({ onDetail, onCatalog }: { onDetail: (p: Product) => void; onCatalog: () => void }) {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PRODUCTS.filter(p => p.featured).slice(0, 4).map(p => (
          <ProductCard key={p.id} product={p} onDetail={onDetail} />
        ))}
      </div>
      <div className="text-center mt-8">
        <button onClick={onCatalog} className="inline-flex items-center gap-2 border border-[#1565ff] text-[#1565ff] hover:bg-[#1565ff] hover:text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200">
          Ver Catálogo Completo <ChevronRight size={18} />
        </button>
      </div>
    </section>
  )
}

function BrandsSection() {
  return (
    <section className="py-16 border-y border-[#1e3a5f]" style={{ background: 'linear-gradient(180deg, #060d1a 0%, #0a1f4e 50%, #060d1a 100%)' }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <div className="text-[#00b4d8] text-sm font-semibold uppercase tracking-widest mb-2">Distribuidores Oficiales</div>
          <h2 className="font-display text-4xl font-bold text-white">Marcas que Comercializamos</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {BRANDS.map((brand, i) => (
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
const ADMIN_NAV: { icon: React.ComponentType<{ size?: number }>; label: string; view: AdminView; badge?: number }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: Database, label: 'Inventario', view: 'inventory' },
  { icon: Package, label: 'Productos', view: 'products' },
  { icon: Tag, label: 'Categorías', view: 'categories' },
  { icon: Building2, label: 'Marcas', view: 'brands' },
  { icon: Truck, label: 'Proveedores', view: 'suppliers' },
  { icon: Users, label: 'Clientes', view: 'clients' },
  { icon: ShoppingCart, label: 'Órdenes', view: 'orders' },
  { icon: FileSpreadsheet, label: 'Importar Excel', view: 'import' },
  { icon: BarChart3, label: 'Reportes', view: 'reports' },
  { icon: History, label: 'Auditoría', view: 'audit' },
  { icon: Bell, label: 'Notificaciones', view: 'notifications', badge: 3 },
  { icon: Settings, label: 'Configuración', view: 'settings' },
]

function AdminSidebar({ current, onNav, onPublic, collapsed, setCollapsed }: {
  current: AdminView; onNav: (v: AdminView) => void; onPublic: () => void
  collapsed: boolean; setCollapsed: (v: boolean) => void
}) {
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
        {ADMIN_NAV.map(({ icon: Icon, label, view, badge }) => (
          <button
            key={view}
            onClick={() => onNav(view)}
            className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative ${current === view ? 'active text-white bg-[#1565ff]/20 border-l-[3px] border-[#00b4d8]' : 'text-[#93c5fd] hover:text-white border-l-[3px] border-transparent'}`}
          >
            <Icon size={17} className="flex-shrink-0" />
            {!collapsed && <span className="font-medium truncate">{label}</span>}
            {badge && !collapsed && (
              <span className="ml-auto bg-[#1565ff] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 badge-pulse">
                {badge}
              </span>
            )}
            {badge && collapsed && (
              <span className="absolute top-1 right-1 bg-red-500 w-2 h-2 rounded-full badge-pulse" />
            )}
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-[#1e3a5f] p-3 space-y-1">
        <button onClick={onPublic} className="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#93c5fd] hover:text-white border-l-[3px] border-transparent transition-all">
          <Navigation size={17} className="flex-shrink-0" />
          {!collapsed && <span className="font-medium">Ver Sitio</span>}
        </button>
        <button className="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 border-l-[3px] border-transparent transition-all">
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span className="font-medium">Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  )
}

function AdminTopbar({ title, subtitle, notifications }: { title: string; subtitle?: string; notifications: number }) {
  return (
    <header className="h-16 flex items-center justify-between px-6 glass border-b border-[#1e3a5f]">
      <div>
        <h1 className="font-display text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-[#64748b] text-xs">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button className="relative text-[#64748b] hover:text-white transition-colors">
          <Bell size={20} />
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#1565ff] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center badge-pulse">
              {notifications}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1565ff] to-[#00b4d8] flex items-center justify-center text-white text-sm font-bold">A</div>
          <div className="hidden sm:block">
            <div className="text-white text-xs font-medium">Admin</div>
            <div className="text-[#64748b] text-xs">admin@bahianacho.com</div>
          </div>
        </div>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────
function AdminDashboard() {
  const stats = [
    { label: 'Productos Registrados', value: '2,148', change: '+32 este mes', icon: Package, trend: 'up', color: '#1565ff' },
    { label: 'Stock Disponible', value: '8,432', change: '+156 esta semana', icon: Database, trend: 'up', color: '#00b4d8' },
    { label: 'Productos Agotados', value: '14', change: '+3 hoy', icon: AlertTriangle, trend: 'down', color: '#ef4444' },
    { label: 'Stock Bajo', value: '23', change: '−5 vs ayer', icon: TrendingDown, trend: 'up', color: '#f59e0b' },
    { label: 'Consultas Hoy', value: '47', change: '+12 vs ayer', icon: MessageCircle, trend: 'up', color: '#10b981' },
    { label: 'Marcas Activas', value: '8', change: 'Sin cambios', icon: Award, trend: 'neutral', color: '#8b5cf6' },
  ]

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
              <div className="font-display text-2xl font-bold text-white mb-1">{s.value}</div>
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
          <h3 className="font-display font-bold text-white mb-4">Movimiento de Inventario — 2026</h3>
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
          <h3 className="font-display font-bold text-white mb-4">Ventas por Categoría</h3>
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
          <div className="space-y-1.5">
            {salesByCategory.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-[#93c5fd]">{s.name}</span>
                </div>
                <span className="text-white font-medium font-mono">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent audit */}
      <div className="glass border border-[#1e3a5f] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white">Actividad Reciente</h3>
          <button className="text-[#1565ff] hover:text-[#00b4d8] text-xs transition-colors">Ver todo</button>
        </div>
        <div className="space-y-3">
          {AUDIT_LOG.slice(0, 4).map(log => (
            <div key={log.id} className="flex items-start gap-3 text-sm">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${log.type === 'add' ? 'bg-green-900/50 text-green-400' : log.type === 'delete' ? 'bg-red-900/50 text-red-400' : log.type === 'import' ? 'bg-blue-900/50 text-blue-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                {log.type === 'add' ? <Plus size={12} /> : log.type === 'delete' ? <Trash2 size={12} /> : log.type === 'import' ? <Upload size={12} /> : <Edit2 size={12} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium">{log.action}</div>
                <div className="text-[#64748b] text-xs truncate">{log.detail}</div>
              </div>
              <div className="text-[#64748b] text-xs flex-shrink-0">{log.date.split(' ')[1]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADMIN INVENTORY
// ─────────────────────────────────────────────
function AdminInventory() {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<keyof Product>('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const perPage = 5

  const filtered = PRODUCTS.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  }).sort((a, b) => {
    const av = a[sortKey] as string | number
    const bv = b[sortKey] as string | number
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const paginated = filtered.slice(page * perPage, page * perPage + perPage)
  const totalPages = Math.ceil(filtered.length / perPage)

  const handleSort = (k: keyof Product) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: keyof Product }) => (
    sortKey === k
      ? sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
      : <div className="w-3" />
  )

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
          <button className="flex items-center gap-2 bg-[#1565ff] hover:bg-[#1252d3] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all glow-blue">
            <Plus size={15} /> Agregar
          </button>
          <button className="flex items-center gap-2 glass border border-[#1e3a5f] hover:border-[#1565ff] text-[#93c5fd] text-sm px-3 py-2 rounded-lg transition-all">
            <Download size={15} /> Exportar
          </button>
        </div>
      </div>

      <div className="glass border border-[#1e3a5f] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0a1628]">
                {[['code', 'Código'], ['name', 'Producto'], ['brand', 'Marca'], ['category', 'Categoría'], ['stock', 'Stock'], ['price', 'Precio'], ['', 'Estado'], ['', 'Acciones']].map(([k, l]) => (
                  <th key={l} className="px-4 py-3 text-left text-xs text-[#64748b] font-medium">
                    {k ? (
                      <button className="flex items-center gap-1 hover:text-white transition-colors" onClick={() => handleSort(k as keyof Product)}>
                        {l} <SortIcon k={k as keyof Product} />
                      </button>
                    ) : l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(p => (
                <tr key={p.id} className="table-row-hover border-b border-[#1e3a5f]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-[#00b4d8]">{p.code}</div>
                    <div className="text-[#64748b] text-xs">{p.oemCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover bg-[#0a1628] flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=40&h=40&fit=crop' }} />
                      <div className="min-w-0">
                        <div className="text-white text-xs font-medium truncate max-w-[200px]">{p.name}</div>
                        <div className="text-[#64748b] text-xs truncate max-w-[200px]">{p.compatibility[0]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#93c5fd] text-xs">{p.brand}</td>
                  <td className="px-4 py-3 text-[#64748b] text-xs">{p.category}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-white font-medium text-xs">{p.stock}</div>
                    <div className="text-[#64748b] text-xs">mín: {p.minStock}</div>
                  </td>
                  <td className="px-4 py-3 font-display font-bold text-white text-sm">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3"><StockBadge stock={p.stock} min={p.minStock} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-lg text-[#64748b] hover:text-[#00b4d8] hover:bg-[#00b4d8]/10 transition-all"><Eye size={13} /></button>
                      <button className="p-1.5 rounded-lg text-[#64748b] hover:text-[#1565ff] hover:bg-[#1565ff]/10 transition-all"><Edit2 size={13} /></button>
                      <button className="p-1.5 rounded-lg text-[#64748b] hover:text-[#93c5fd] hover:bg-white/5 transition-all"><Copy size={13} /></button>
                      <button className="p-1.5 rounded-lg text-[#64748b] hover:text-red-400 hover:bg-red-900/20 transition-all"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e3a5f] text-xs text-[#64748b]">
          <span>Mostrando {paginated.length} de {filtered.length} resultados</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`w-6 h-6 rounded-lg text-xs transition-all ${page === i ? 'bg-[#1565ff] text-white' : 'hover:bg-white/5 text-[#64748b]'}`}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADMIN IMPORT
// ─────────────────────────────────────────────
function AdminImport() {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    setFile('inventario_julio_2026.xlsx')
    setPreview(false)
    setDone(false)
  }

  const handleImport = () => {
    setImporting(true)
    setTimeout(() => { setImporting(false); setDone(true) }, 2000)
  }

  const previewRows = [
    { code: 'BN-001', name: 'Impeller Kit Yamaha 40-60 HP', stock: 35, price: 48.50, status: 'Actualizar' },
    { code: 'BN-009', name: 'Filtro Combustible Honda BF40', stock: 18, price: 22.00, status: 'Crear' },
    { code: 'BN-006', name: 'Kit Arranque Tohatsu MFS', stock: 0, price: 218.00, status: 'Actualizar' },
    { code: 'BN-010', name: 'Cable Dirección 10ft Mercury', stock: 7, price: 65.00, status: 'Crear' },
    { code: 'BN-003', name: 'Carburador Yamaha 25-30 HP', stock: 6, price: 132.00, status: 'Actualizar' },
  ]

  const historyRows = [
    { file: 'inventario_junio_2026.xlsx', user: 'admin@bahianacho.com', date: '2026-06-30 09:15', created: 12, updated: 54, errors: 2 },
    { file: 'importacion_mayo.xlsx', user: 'inventario@bahianacho.com', date: '2026-05-31 11:00', created: 8, updated: 41, errors: 0 },
    { file: 'stock_abril.xlsx', user: 'admin@bahianacho.com', date: '2026-04-30 14:20', created: 5, updated: 38, errors: 1 },
  ]

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div className="glass border border-[#1e3a5f] rounded-xl p-6">
        <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2"><Upload size={18} className="text-[#00b4d8]" /> Importar Archivo Excel</h3>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${dragging ? 'border-[#1565ff] bg-[#1565ff]/10' : 'border-[#1e3a5f] hover:border-[#1565ff]/50 hover:bg-[#1565ff]/5'}`}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0].name); setPreview(false); setDone(false) } }} />
          <FileSpreadsheet size={40} className={`mx-auto mb-3 ${dragging ? 'text-[#1565ff]' : 'text-[#64748b]'}`} />
          {file ? (
            <>
              <p className="text-white font-semibold">{file}</p>
              <p className="text-[#00b4d8] text-sm mt-1">Archivo listo para importar</p>
            </>
          ) : (
            <>
              <p className="text-[#93c5fd] font-medium">Arrastra tu archivo Excel aquí</p>
              <p className="text-[#64748b] text-sm mt-1">o haz clic para seleccionar (.xlsx, .xls, .csv)</p>
              <p className="text-[#64748b] text-xs mt-3">Descarga la plantilla para asegurar el formato correcto</p>
            </>
          )}
        </div>

        {file && !done && (
          <div className="flex gap-3 mt-4">
            <button onClick={() => setPreview(true)} className="flex items-center gap-2 glass border border-[#1e3a5f] hover:border-[#1565ff] text-[#93c5fd] hover:text-white text-sm px-4 py-2 rounded-lg transition-all">
              <Eye size={14} /> Vista Previa
            </button>
            <button onClick={handleImport} disabled={importing}
              className="flex items-center gap-2 bg-[#1565ff] hover:bg-[#1252d3] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all glow-blue">
              {importing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Importando…' : 'Importar Datos'}
            </button>
            <button onClick={() => { setFile(null); setPreview(false) }} className="text-[#64748b] hover:text-red-400 text-sm px-3 transition-colors">
              Cancelar
            </button>
          </div>
        )}

        {done && (
          <div className="mt-4 flex items-center gap-3 bg-green-900/20 border border-green-800 rounded-xl px-4 py-3">
            <CheckCircle size={18} className="text-green-400" />
            <div>
              <div className="text-green-400 font-semibold text-sm">Importación completada exitosamente</div>
              <div className="text-[#64748b] text-xs">3 productos creados · 45 actualizados · 0 errores</div>
            </div>
          </div>
        )}
      </div>

      {/* Preview table */}
      {preview && (
        <div className="glass border border-[#1e3a5f] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e3a5f] flex items-center gap-2">
            <Eye size={15} className="text-[#00b4d8]" />
            <h3 className="font-semibold text-white text-sm">Vista Previa — 5 de 48 registros</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a1628] border-b border-[#1e3a5f]">
                  {['Código', 'Nombre', 'Stock', 'Precio', 'Acción'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs text-[#64748b] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map(r => (
                  <tr key={r.code} className="border-b border-[#1e3a5f]/50 table-row-hover transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-[#00b4d8]">{r.code}</td>
                    <td className="px-4 py-2.5 text-white text-xs">{r.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white">{r.stock}</td>
                    <td className="px-4 py-2.5 text-white text-xs">{formatPrice(r.price)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${r.status === 'Crear' ? 'bg-green-900/40 text-green-400 border-green-800' : 'bg-blue-900/40 text-blue-400 border-blue-800'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import history */}
      <div className="glass border border-[#1e3a5f] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e3a5f]">
          <h3 className="font-display font-bold text-white text-sm flex items-center gap-2"><History size={15} className="text-[#00b4d8]" /> Historial de Importaciones</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a1628] border-b border-[#1e3a5f]">
                {['Archivo', 'Usuario', 'Fecha', 'Creados', 'Actualizados', 'Errores'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-[#64748b] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyRows.map(r => (
                <tr key={r.file} className="border-b border-[#1e3a5f]/50 table-row-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={14} className="text-green-400" />
                      <span className="text-white text-xs">{r.file}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#93c5fd] text-xs">{r.user}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{r.date}</td>
                  <td className="px-4 py-3 text-green-400 font-mono text-xs">+{r.created}</td>
                  <td className="px-4 py-3 text-blue-400 font-mono text-xs">~{r.updated}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${r.errors > 0 ? 'text-red-400' : 'text-[#64748b]'}`}>{r.errors}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADMIN AUDIT
// ─────────────────────────────────────────────
function AdminAudit() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
          <input type="text" placeholder="Filtrar por usuario o acción…"
            className="w-full glass border border-[#1e3a5f] focus:border-[#1565ff] bg-transparent pl-9 pr-3 py-2 text-white placeholder-[#64748b] rounded-lg text-sm outline-none" />
        </div>
        <button className="flex items-center gap-2 glass border border-[#1e3a5f] hover:border-[#1565ff] text-[#93c5fd] text-sm px-3 py-2 rounded-lg transition-all">
          <Download size={14} /> Exportar
        </button>
      </div>

      <div className="glass border border-[#1e3a5f] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a1628] border-b border-[#1e3a5f]">
                {['Tipo', 'Usuario', 'Acción', 'Detalle', 'Fecha y Hora'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-[#64748b] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AUDIT_LOG.map(log => (
                <tr key={log.id} className="table-row-hover border-b border-[#1e3a5f]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${log.type === 'add' ? 'bg-green-900/50 text-green-400' : log.type === 'delete' ? 'bg-red-900/50 text-red-400' : log.type === 'import' ? 'bg-blue-900/50 text-blue-400' : log.type === 'settings' ? 'bg-purple-900/50 text-purple-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                      {log.type === 'add' ? <Plus size={12} /> : log.type === 'delete' ? <Trash2 size={12} /> : log.type === 'import' ? <Upload size={12} /> : log.type === 'settings' ? <Settings size={12} /> : <Edit2 size={12} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#93c5fd] text-xs">{log.user}</td>
                  <td className="px-4 py-3 text-white text-xs font-medium">{log.action}</td>
                  <td className="px-4 py-3 text-[#64748b] text-xs max-w-xs truncate">{log.detail}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{log.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADMIN NOTIFICATIONS
// ─────────────────────────────────────────────
function AdminNotifications({ onMarkRead }: { onMarkRead: () => void }) {
  const [notifications, setNotifications] = useState(NOTIFICATIONS_DATA)

  const markAll = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    onMarkRead()
  }

  const iconMap = { warning: AlertTriangle, error: AlertTriangle, success: CheckCircle, info: Info }
  const colorMap = { warning: 'text-yellow-400 bg-yellow-900/30 border-yellow-800', error: 'text-red-400 bg-red-900/30 border-red-800', success: 'text-green-400 bg-green-900/30 border-green-800', info: 'text-blue-400 bg-blue-900/30 border-blue-800' }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="text-[#64748b] text-sm">{notifications.filter(n => !n.read).length} sin leer</div>
        <button onClick={markAll} className="text-[#1565ff] hover:text-[#00b4d8] text-sm transition-colors">Marcar todas como leídas</button>
      </div>
      {notifications.map(n => {
        const Icon = iconMap[n.type as keyof typeof iconMap]
        return (
          <div key={n.id} className={`glass border rounded-xl p-4 flex gap-4 transition-opacity ${n.read ? 'opacity-60' : ''}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${colorMap[n.type as keyof typeof colorMap]}`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-white text-sm">{n.title}</div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-[#1565ff] flex-shrink-0 mt-1.5 badge-pulse" />}
              </div>
              <p className="text-[#93c5fd] text-xs mt-0.5 leading-relaxed">{n.message}</p>
              <div className="text-[#64748b] text-xs mt-1">{n.time}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// ADMIN PLACEHOLDER SECTIONS
// ─────────────────────────────────────────────
function AdminPlaceholder({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 glass border border-[#1e3a5f] rounded-xl text-center">
      <Icon size={40} className="text-[#1565ff]/40 mb-3" />
      <p className="text-white font-semibold">{title}</p>
      <p className="text-[#64748b] text-sm mt-1">Módulo en desarrollo</p>
      <button className="mt-4 flex items-center gap-2 bg-[#1565ff] hover:bg-[#1252d3] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">
        <Plus size={14} /> Crear nuevo
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADMIN PANEL WRAPPER
// ─────────────────────────────────────────────
function AdminPanel({ onPublic }: { onPublic: () => void }) {
  const [adminView, setAdminView] = useState<AdminView>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [notifCount, setNotifCount] = useState(3)

  const adminTitles: Record<AdminView, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Resumen general de la operación' },
    inventory: { title: 'Inventario', subtitle: 'Gestión completa de stock y productos' },
    products: { title: 'Productos', subtitle: 'Crear, editar y gestionar el catálogo' },
    categories: { title: 'Categorías', subtitle: 'Organización del catálogo por categorías' },
    brands: { title: 'Marcas', subtitle: 'Gestión de marcas comercializadas' },
    suppliers: { title: 'Proveedores', subtitle: 'Base de datos de proveedores' },
    clients: { title: 'Clientes', subtitle: 'Registro y gestión de clientes' },
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
      <AdminSidebar current={adminView} onNav={setAdminView} onPublic={onPublic} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <AdminTopbar title={title} subtitle={subtitle} notifications={notifCount} />
        <main className="flex-1 p-6 overflow-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] mb-5">
            <span>Bahía Nacho</span>
            <ChevronRight size={12} />
            <span className="text-[#93c5fd]">{title}</span>
          </div>

          {adminView === 'dashboard' && <AdminDashboard />}
          {adminView === 'inventory' && <AdminInventory />}
          {adminView === 'import' && <AdminImport />}
          {adminView === 'audit' && <AdminAudit />}
          {adminView === 'notifications' && <AdminNotifications onMarkRead={() => setNotifCount(0)} />}
          {adminView === 'products' && <AdminPlaceholder title="Gestión de Productos" icon={Package} />}
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
function HomePage({ onSearch, onDetail, onCatalog }: {
  onSearch: (q: string) => void; onDetail: (p: Product) => void; onCatalog: () => void
}) {
  return (
    <>
      <HeroSection onSearch={onSearch} />
      <FeaturedSection onDetail={onDetail} onCatalog={onCatalog} />
      <BrandsSection />
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
  const [view, setView] = useState<View>('home')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [navSection, setNavSection] = useState('inicio')

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

  if (view === 'admin') return <AdminPanel onPublic={() => { setView('home'); window.scrollTo({ top: 0 }) }} />

  return (
    <div className="min-h-screen bg-[#060d1a]">
      <PublicNavbar
        onAdminClick={() => setView('admin')}
        currentSection={navSection}
        onNav={handleNav}
      />

      {view === 'home' && (
        <HomePage
          onSearch={q => goToCatalog(q)}
          onDetail={goToProduct}
          onCatalog={() => goToCatalog()}
        />
      )}
      {view === 'catalog' && (
        <CatalogPage
          onDetail={goToProduct}
          initialQuery={catalogQuery}
        />
      )}
      {view === 'product' && selectedProduct && (
        <ProductDetailPage
          product={selectedProduct}
          onBack={() => { setView('catalog'); window.scrollTo({ top: 0 }) }}
        />
      )}

      {view !== 'admin' && <Footer onNav={handleNav} />}
    </div>
  )
}
