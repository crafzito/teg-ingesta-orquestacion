import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, CardBody, Input, Chip } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Info,
  LogIn,
  Search,
  ShieldAlert,
  X,
  ZoomIn,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuthStore } from '../stores/authStore'

interface ManualImage {
  src: string
  caption?: string
}

type ManualBlock =
  | string
  | { type: 'list'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'warn'; text: string }

interface ManualSection {
  id: string
  number: string
  title: string
  body: ManualBlock[]
  images?: ManualImage[]
  subsections?: ManualSection[]
}

const IMG = (name: string) => `/manual/${name}`

const SECTIONS: ManualSection[] = [
  {
    id: 'sec-1',
    number: '1',
    title: '¿Qué es esta Aplicación?',
    body: [
      'Esta Aplicación es una herramienta web que toma los archivos CSV que SAP genera todos los días y los convierte en dashboards, reportes y consultas listas para que la gerencia y los equipos de trabajo puedan tomar decisiones sin tener que abrir hojas de cálculo ni consolidar datos manualmente.',
      'En pocas palabras: SAP exporta archivos → la Aplicación los procesa automáticamente → usted entra al navegador y ve toda la información consolidada en tiempo real.',
    ],
    subsections: [
      {
        id: 'sec-1-1',
        number: '1.1',
        title: '¿Qué problemas resuelve?',
        body: [
          'Antes de esta Aplicación, la información de ventas, cobranzas, inventario y producción se consolidaba manualmente en Excel. Esto generaba demoras, errores de transcripción y versiones contradictorias del mismo reporte. Ahora, todos los datos están en un solo lugar, actualizados y listos para consultar.',
        ],
      },
      {
        id: 'sec-1-2',
        number: '1.2',
        title: 'Las tres sociedades del grupo',
        body: [
          'La Aplicación maneja información de tres empresas del grupo:',
          {
            type: 'list',
            items: [
              'Sociedad 1000 — Pharsana (División Consumo): centros de trabajo 1000, 1001 y 1002.',
              'Sociedad 1200 — Ampofrasca (División Empaque): centro de trabajo 1200.',
              'Sociedad 1300 — Proyectos PET (División Empaque): centro de trabajo 1300.',
            ],
          },
          'Cuando usted filtra por sociedad en cualquier pantalla, verá solamente la información de esa empresa. Si no aplica filtro, verá el consolidado de las tres.',
        ],
      },
      {
        id: 'sec-1-3',
        number: '1.3',
        title: '¿Qué NO hace la Aplicación?',
        body: [
          'La Aplicación no se conecta directamente a SAP: necesita que los archivos CSV sean depositados en la carpeta designada. Tampoco genera facturas, no realiza proyecciones financieras y no modifica datos en SAP. Es una herramienta de consulta y análisis.',
        ],
      },
    ],
  },
  {
    id: 'sec-2',
    number: '2',
    title: 'Tipos de usuario',
    body: ['La Aplicación tiene tres tipos de usuario. Cada uno puede ver y hacer cosas diferentes según su responsabilidad.'],
    subsections: [
      {
        id: 'sec-2-1',
        number: '2.1',
        title: 'Superadministrador',
        body: [
          'Es el responsable máximo del sistema. Puede hacer todo lo que hacen los otros dos roles y además:',
          {
            type: 'list',
            items: [
              'Crear, editar, restablecer contraseña y desactivar usuarios.',
              'Asignar la cédula de identidad de cada usuario (necesaria para el reset de contraseña self-service).',
              'Configurar qué secciones del menú ve cada tipo de usuario desde la pestaña Configuración.',
              'Revisar los indicadores del sistema (usuarios activos, vistas protegidas, vistas personalizadas, directorios monitoreados).',
              'Acceder a todas las demás pantallas (Dashboard, Ventas, Finanzas, Operaciones, Maestros, Monitor ETL).',
            ],
          },
        ],
      },
      {
        id: 'sec-2-2',
        number: '2.2',
        title: 'Administrador',
        body: [
          'Es el operador técnico. Se encarga de que los datos fluyan correctamente desde SAP hasta la Aplicación:',
          {
            type: 'list',
            items: [
              'Monitorea y ejecuta la carga de archivos (ETL) desde la opción Monitor ETL.',
              'Consulta los mismos módulos de negocio que un analista (Ventas, Finanzas, Operaciones, Maestros).',
            ],
          },
          'No puede administrar usuarios ni configurar el menú lateral; esas funciones son exclusivas del superadministrador.',
        ],
      },
      {
        id: 'sec-2-3',
        number: '2.3',
        title: 'Analista',
        body: [
          'Es el consumidor de información. Entra a la Aplicación para consultar y analizar los datos:',
          {
            type: 'list',
            items: [
              'Ve el Dashboard con los indicadores principales.',
              'Navega los módulos de Ventas, Finanzas, Operaciones y Maestros.',
              'Aplica los filtros del panel (Sociedad, Período y, donde aplica, Centro) para acotar la información.',
              'Usa la caja de búsqueda de cada tabla para encontrar registros específicos.',
            ],
          },
          'No puede ejecutar cargas de datos ni administrar usuarios.',
        ],
      },
    ],
  },
  {
    id: 'sec-3',
    number: '3',
    title: 'Primer ingreso al sistema',
    body: [
      'Para entrar a la Aplicación, abra su navegador web y vaya a la dirección que le haya proporcionado el equipo técnico.',
    ],
    subsections: [
      {
        id: 'sec-3-1',
        number: '3.1',
        title: 'Credenciales iniciales (instalación)',
        body: [
          'Al instalar la Aplicación por primera vez, se crean tres usuarios de prueba, visibles en la pantalla de login como "Credenciales demo":',
          {
            type: 'list',
            items: [
              'superadmin / SuperAdmin#2026',
              'admin / Admin#2026',
              'analista / Analista#2026',
            ],
          },
          {
            type: 'warn',
            text: 'Estas contraseñas son solo para pruebas. El superadministrador debe cambiarlas inmediatamente después de verificar que el sistema funciona, y crear las cuentas reales del equipo antes de poner la aplicación en producción.',
          },
        ],
      },
      {
        id: 'sec-3-2',
        number: '3.2',
        title: 'Cómo iniciar sesión',
        body: [
          {
            type: 'list',
            items: [
              'Abra la Aplicación en el navegador. Verá la pantalla de inicio de sesión.',
              'Escriba su nombre de usuario y contraseña.',
              'Haga clic en "Iniciar sesión".',
              'Si los datos son correctos, verá el Dashboard principal.',
            ],
          },
          'Si las credenciales son incorrectas aparecerá el mensaje "Credenciales invalidas" y podrá reintentar.',
          'Debajo del formulario también encontrará el enlace "¿Olvidaste tu contraseña?" para iniciar el flujo de restablecimiento por su cuenta (ver sección 3.5).',
        ],
        images: [
          { src: IMG('v2_login.png'), caption: 'Pantalla de inicio de sesión con el enlace "¿Olvidaste tu contraseña?"' },
          { src: IMG('3_2_login_filled.png'), caption: 'Formulario completado, listo para enviar' },
        ],
      },
      {
        id: 'sec-3-3',
        number: '3.3',
        title: 'Duración de la sesión',
        body: [
          'La sesión dura varias horas. Pasado ese tiempo, el sistema le pedirá que vuelva a ingresar su usuario y contraseña. Si ve mensajes de «no autorizado» después de un uso prolongado, cierre sesión y vuelva a entrar.',
        ],
      },
      {
        id: 'sec-3-4',
        number: '3.4',
        title: 'Cerrar sesión',
        body: [
          'En la esquina superior derecha de cualquier pantalla aparece su nombre de usuario, el rol ("GOBERNANZA TOTAL" para superadministrador) y el botón "Cerrar sesion". Pulsarlo lo lleva de vuelta al login.',
        ],
      },
      {
        id: 'sec-3-5',
        number: '3.5',
        title: 'Restablecer mi contraseña (self-service)',
        body: [
          'Si olvidó su contraseña, no es necesario contactar al superadministrador para que la genere por usted: la Aplicación incluye un flujo de auto-restablecimiento accesible desde el enlace "¿Olvidaste tu contraseña?" en la pantalla de login.',
          'El flujo verifica su identidad con dos datos que solo usted conoce: su nombre de usuario y su cédula de identidad. Si ambos coinciden con los registrados, podrá establecer una nueva contraseña inmediatamente.',
          'Pasos:',
          {
            type: 'list',
            items: [
              'En la pantalla de login pulse "¿Olvidaste tu contraseña?".',
              'Escriba su nombre de usuario y su cédula de identidad.',
              'Escriba la nueva contraseña y vuelva a escribirla en "Confirmar contraseña" para evitar errores de tipeo.',
              'Pulse el botón para confirmar el cambio.',
              'Vuelva al login y entre con la nueva contraseña.',
            ],
          },
          'La nueva contraseña debe cumplir las mismas reglas que se piden al crear un usuario:',
          {
            type: 'list',
            items: [
              'Al menos 8 caracteres.',
              'Al menos una letra mayúscula.',
              'Al menos una letra minúscula.',
              'Al menos un número.',
            ],
          },
          {
            type: 'warn',
            text: 'La cédula registrada en su perfil debe coincidir exactamente con la que ingresa (sin puntos, guiones ni espacios extra, tal como se la cargó el superadministrador). Si no tiene cédula registrada, este flujo no funcionará: pídale al superadministrador que la asigne en el panel de Administración (sección 12.1).',
          },
        ],
        images: [
          { src: IMG('v2_forgot_password_empty.png'), caption: 'Formulario de restablecimiento: usuario, cédula y nueva contraseña' },
          { src: IMG('v2_forgot_password_filled.png'), caption: 'Formulario completado, listo para confirmar el cambio' },
        ],
      },
    ],
  },
  {
    id: 'sec-4',
    number: '4',
    title: 'Navegación general',
    body: ['Al iniciar sesión verá la barra lateral con el menú a la izquierda y la cabecera con su perfil en la esquina superior derecha.'],
    subsections: [
      {
        id: 'sec-4-1',
        number: '4.1',
        title: 'Barra lateral (menú)',
        body: [
          'El menú se organiza en cinco secciones:',
          {
            type: 'list',
            items: [
              'PRINCIPAL: Dashboard, Ventas.',
              'FINANZAS: Cuentas por Cobrar, Cuentas por Pagar.',
              'OPERACIONES: Inventario, Producción, Pedidos.',
              'MAESTROS: Clientes, Productos.',
              'SISTEMA: Monitor ETL (admin y superadmin), Administración (solo superadmin), Ayuda / Manual (todos).',
            ],
          },
          'Puede colapsar la barra lateral usando la flecha superior izquierda para ganar espacio en la pantalla.',
        ],
        images: [{ src: IMG('4_1_sidebar.png'), caption: 'Menú lateral con la vista de Superadministrador (incluye todas las secciones)' }],
      },
      {
        id: 'sec-4-2',
        number: '4.2',
        title: 'Filtros del panel',
        body: [
          'En la parte superior de cada pantalla del panel aparece una barra de filtros (FilterBar) que aplica de forma inmediata a KPIs, gráficos y tablas. La barra agrupa hasta tres filtros, según la pantalla:',
          {
            type: 'list',
            items: [
              'Sociedad — segmented control con cuatro chips: Todas, Pharsana (1000), Ampofrasca (1200) y Proy. PET (1300). Se selecciona haciendo clic en la opción deseada (a diferencia del antiguo dropdown).',
              'Período — segmented control con cuatro opciones: Mes (mes en curso), Trim. (trimestre actual), Año (año actual) y Todo (sin restricción de fecha).',
              'Centro — disponible únicamente en Inventario y Producción. Permite acotar a un centro de trabajo específico: Todos, 1000, 1001, 1002, 1200 o 1300.',
            ],
          },
          'Los filtros son acumulativos: si elige Pharsana + Trim., verá únicamente la información de la sociedad 1000 dentro del trimestre actual. El cambio se refleja en milisegundos en todos los componentes de la pantalla.',
          {
            type: 'note',
            text: 'Si un KPI o gráfico aparece en cero después de aplicar filtros, es porque no hay datos para esa combinación de Sociedad/Período/Centro, no porque la Aplicación tenga un error.',
          },
        ],
        images: [{ src: IMG('v2_filterbar.png'), caption: 'Barra de filtros: Sociedad (chips), Período (Mes/Trim./Año/Todo) y, donde aplica, Centro' }],
      },
      {
        id: 'sec-4-3',
        number: '4.3',
        title: 'Tablas y paginación',
        body: [
          'Las tablas tienen caja de búsqueda, encabezados ordenables haciendo clic, y paginación en la parte inferior. El total de registros aparece en la cabecera de la tabla.',
        ],
        images: [{ src: IMG('4_3_tabla_paginada.png'), caption: 'Tabla con controles de paginación en la parte inferior' }],
      },
    ],
  },
  {
    id: 'sec-5',
    number: '5',
    title: 'Dashboard principal',
    body: [
      'El Dashboard es la primera pantalla que ve al entrar. En la parte superior aparece la barra de filtros (Sociedad y Período). Justo debajo encontrará seis KPIs uniformes —misma altura, icono coloreado, valor grande y, donde aplica, una variación porcentual o sparkline— que resumen el negocio: Ventas del Mes, CxC Total, CxC Vencida, Inventario Valorizado, Órdenes Activas y Pedidos del Mes.',
      'Más abajo, tres pestañas (Ventas, Finanzas y Operaciones) agrupan los gráficos. Cada pestaña incorpora visualizaciones nuevas que antes no existían.',
    ],
    images: [{ src: IMG('v2_dashboard_full.png'), caption: 'Dashboard nuevo con FilterBar, KPIs uniformes y la pestaña de Ventas activa (7 gráficos en total)' }],
    subsections: [
      {
        id: 'sec-5-1',
        number: '5.1',
        title: 'Pestaña Ventas',
        body: [
          'Reúne los gráficos de comportamiento comercial. Además de los gráficos clásicos (Ventas Mensuales, Ventas por Sociedad, Top 10 Clientes y Tendencia por Sociedad), se incorporan tres visualizaciones nuevas:',
          {
            type: 'list',
            items: [
              'Composición por Sociedad — gráfico de dona que muestra el peso porcentual de cada sociedad en la facturación del período.',
              'Tickets por Sociedad — barras con la cantidad de facturas emitidas por sociedad.',
              'Ventas vs CxC por Sociedad — barras agrupadas que comparan, por sociedad, lo facturado contra el saldo pendiente de cobro.',
            ],
          },
        ],
        images: [{ src: IMG('5_1_dashboard_ventas.png'), caption: 'Pestaña de Ventas con los gráficos clásicos y los tres nuevos por sociedad' }],
      },
      {
        id: 'sec-5-2',
        number: '5.2',
        title: 'Pestaña Finanzas',
        body: [
          'Muestra Antigüedad CxC (dona) y CxC Total vs Vencida (barras horizontales por tramo: No vencido, 1-15, 16-30, 31-60, 61-90, 91+ días). En esta pestaña se incorpora también:',
          {
            type: 'list',
            items: [
              'Ratio CxC Vencida — gauge (medidor circular) que muestra el porcentaje de la cartera total que está vencida. Sirve como semáforo financiero: cuanto más cerca de 100%, más comprometida está la cobranza.',
            ],
          },
        ],
        images: [{ src: IMG('v2_dashboard_finanzas.png'), caption: 'Pestaña Finanzas con el nuevo gauge "Ratio CxC Vencida"' }],
      },
      {
        id: 'sec-5-3',
        number: '5.3',
        title: 'Pestaña Operaciones',
        body: [
          'Conserva Pedidos por Estatus (dona) y Órdenes por Centro y Estatus (barras apiladas), y suma:',
          {
            type: 'list',
            items: [
              'Órdenes Activas vs Cerradas por Centro — barras agrupadas que comparan, en cada centro de producción, la cantidad de órdenes vivas frente a las cerradas, útil para detectar acumulación de trabajo en curso.',
            ],
          },
        ],
        images: [{ src: IMG('v2_dashboard_operaciones.png'), caption: 'Pestaña Operaciones con el nuevo gráfico Órdenes Activas vs Cerradas por Centro' }],
      },
      {
        id: 'sec-5-4',
        number: '5.4',
        title: 'Actualización de los datos',
        body: [
          'Los indicadores se actualizan cada vez que el ETL procesa archivos nuevos. Si algún KPI muestra cero, significa que no hay datos para el período y sociedad filtrados.',
        ],
      },
    ],
  },
  {
    id: 'sec-6',
    number: '6',
    title: 'Módulo de Ventas',
    body: [
      'Pantalla de análisis de facturación. En la parte superior se muestra una fila de KPIs uniformes (Ventas, Tickets, Ticket promedio, Clientes activos) seguida de la barra de filtros (Sociedad y Período). Cada fila de la tabla representa una línea de factura (combinación de factura + producto).',
    ],
    images: [{ src: IMG('v2_ventas.png'), caption: 'Pantalla de Ventas: fila de KPIs + FilterBar + gráficos + tabla de detalle' }],
    subsections: [
      {
        id: 'sec-6-1',
        number: '6.1',
        title: 'Gráficos principales',
        body: [
          'Debajo de los KPIs aparecen los gráficos: Ventas Mensuales, Top Clientes (3 meses), Ritmo de venta (mes actual vs anterior con ticket promedio) y Top Productos por Venta.',
        ],
        images: [{ src: IMG('6_1_ventas_kpis_graficos.png'), caption: 'Bloque de gráficos en la pantalla de Ventas' }],
      },
      {
        id: 'sec-6-2',
        number: '6.2',
        title: 'Detalle de ventas',
        body: [
          'Debajo de los gráficos aparece la tabla "Detalle de Ventas" con columnas: Sociedad, Cliente, Material, Producto, Fecha, Cantidad y Monto USD.',
          'Use la caja "Buscar..." para filtrar por cualquier texto visible. Los encabezados son ordenables haciendo clic.',
        ],
        images: [{ src: IMG('6_3_ventas_tabla_detalle.png'), caption: 'Tabla de detalle de ventas con paginación' }],
      },
    ],
  },
  {
    id: 'sec-7',
    number: '7',
    title: 'Módulo de Finanzas',
    body: ['Incluye Cuentas por Cobrar (CxC) y Cuentas por Pagar (CxP).'],
    subsections: [
      {
        id: 'sec-7-1',
        number: '7.1',
        title: 'Cuentas por Cobrar (CxC)',
        body: [
          'La pantalla abre con una fila de KPIs uniformes (Total CxC, CxC vencida, % vencido, Clientes con saldo) y la barra de filtros. Debajo, tres gráficos: Antigüedad CxC (dona), Top Clientes por Saldo (barras) y Antigüedad por Monto (barras horizontales).',
          'Tabla inferior "Detalle CxC" con Sociedad, Cliente, Documento, Fecha Doc, Vencimiento, Valor, Días Vencido y Total Vencido.',
          'Tramos de antigüedad utilizados:',
          {
            type: 'list',
            items: [
              'No vencido — documentos cuya fecha de pago aún no llega.',
              '1 a 15 días — vencidos recientemente.',
              '16 a 30 días — en seguimiento.',
              '31 a 60 días — requiere atención activa.',
              '61 a 90 días — situación seria.',
              '91+ días — crítico, gestión inmediata.',
            ],
          },
          {
            type: 'note',
            text: 'Los datos reflejan el último archivo procesado desde SAP. Si hoy se recibió un pago pero aún no se cargó el archivo actualizado, el saldo seguirá apareciendo.',
          },
        ],
        images: [{ src: IMG('v2_cxc.png'), caption: 'Pantalla de Cuentas por Cobrar con KPIs + FilterBar' }],
      },
      {
        id: 'sec-7-2',
        number: '7.2',
        title: 'Cuentas por Pagar (CxP)',
        body: [
          'Mismo formato que CxC pero para proveedores. Gráficos: Antigüedad CxP, Top Proveedores por Saldo y Antigüedad por Monto.',
          'Tabla "Detalle CxP" con Sociedad, Proveedor, Documento, Fecha Doc, Vencimiento, Importe y Días Vencido.',
          'Los tramos son: Por vencer, 1-30, 31-60, 61-90, 91+ días.',
        ],
        images: [{ src: IMG('7_2_cxp.png'), caption: 'Pantalla de Cuentas por Pagar' }],
      },
    ],
  },
  {
    id: 'sec-8',
    number: '8',
    title: 'Módulo de Operaciones',
    body: ['Tres pantallas: Pedidos, Producción e Inventario. En Producción e Inventario, la barra de filtros incluye un selector adicional de Centro.'],
    subsections: [
      {
        id: 'sec-8-1',
        number: '8.1',
        title: 'Pedidos',
        body: [
          'Dos gráficos: Pedidos por Estatus (dona con concluido, no suministrado, pendiente, entregar parcialm.) y Pedidos Mensuales.',
          'Tabla "Detalle de Pedidos" con Pedido, Cliente, Material, Producto, Cantidad, Valor Neto, Estatus y Fecha. Un pedido con varios productos aparece como varias filas.',
        ],
        images: [{ src: IMG('8_1_pedidos.png'), caption: 'Pantalla de Pedidos' }],
      },
      {
        id: 'sec-8-2',
        number: '8.2',
        title: 'Producción',
        body: [
          'La barra de filtros incluye Sociedad, Período y Centro (Todos / 1000 / 1001 / 1002 / 1200 / 1300). Dos gráficos: Órdenes por Estatus (Liberados, Cerrado técnicamente, Abiertos) y Órdenes por Centro.',
          'Tabla "Detalle de Órdenes" con Centro, Orden, Material, Producto, Cant. Orden, Cant. Recibida, Estatus, Inicio y Fin. Una orden con fecha de fin vencida y cantidad recibida baja indica atraso.',
        ],
        images: [{ src: IMG('8_2_produccion.png'), caption: 'Pantalla de Órdenes de Producción' }],
      },
      {
        id: 'sec-8-3',
        number: '8.3',
        title: 'Inventario',
        body: [
          'La barra de filtros incluye Sociedad, Período y Centro. Tres gráficos: Inventario por Centro (barras), Top Materiales por Valor (barras horizontales) y Distribución por Centro (dona).',
          'Tabla "Detalle de Inventario" con Centro, Almacén, Material, Producto, Tipo Inv., Stock, Valor y Unidad. Un material puede aparecer múltiples veces si está en distintos almacenes o tipos de inventario.',
        ],
        images: [{ src: IMG('v2_inventario.png'), caption: 'Pantalla de Inventario con filtro de Centro habilitado' }],
      },
    ],
  },
  {
    id: 'sec-9',
    number: '9',
    title: 'Módulo de Maestros',
    body: ['Catálogos consolidados de Clientes y Productos importados de SAP. No son editables desde la Aplicación.'],
    subsections: [
      {
        id: 'sec-9-1',
        number: '9.1',
        title: 'Clientes',
        body: [
          'Tabla con Código, Nombre, Sociedad, Total Ventas, Facturas y Última Compra. Útil para equipo comercial y cobranzas.',
          {
            type: 'note',
            text: 'Si un cliente aparece como "[PLACEHOLDER] xxxxx" es porque la referencia existe en alguna transacción pero el archivo maestro aún no ha llegado. Cuando se cargue el archivo correcto, el nombre se actualizará automáticamente.',
          },
        ],
        images: [{ src: IMG('9_1_clientes.png'), caption: 'Pantalla de Clientes' }],
      },
      {
        id: 'sec-9-2',
        number: '9.2',
        title: 'Productos',
        body: [
          'Tabla con Material, Producto, Unidad, Stock Total y Valor Total. Ordenable por cualquier columna.',
        ],
        images: [{ src: IMG('9_2_productos.png'), caption: 'Pantalla de Productos' }],
      },
    ],
  },
  {
    id: 'sec-10',
    number: '10',
    title: 'Carga de datos desde SAP (Monitor ETL)',
    body: ['Pantalla disponible para administradores y superadministradores. Accesible desde el menú → SISTEMA → Monitor ETL.'],
    subsections: [
      {
        id: 'sec-10-1',
        number: '10.1',
        title: '¿Cómo funciona?',
        body: [
          'SAP genera archivos CSV con la información del día. Esos archivos se depositan en una carpeta designada. El watcher detecta archivos nuevos y los procesa automáticamente en orden: primero catálogos de referencia, luego datos maestros (clientes, productos) y por último las transacciones (ventas, cobranzas, inventario, órdenes).',
        ],
      },
      {
        id: 'sec-10-2',
        number: '10.2',
        title: 'KPIs superiores y pestañas',
        body: [
          'Encima del contenido principal verá cuatro tarjetas resumen:',
          {
            type: 'list',
            items: [
              'Estado: "En espera" o "En ejecución", con fecha de última actualización.',
              'Lotes exitosos: cantidad total y cuántos están activos.',
              'Lotes fallidos: cantidad y resultado del último.',
              'Archivos totales: cuántos archivos hay en la carpeta (separados por tipo CSV/XLSX).',
            ],
          },
          'Debajo hay tres pestañas:',
          {
            type: 'list',
            items: [
              'Batches Recientes: últimas corridas con ID, estado, tipo de disparo (MANUAL/WATCHER), fecha de inicio/fin y conteos.',
              'Estado por Fuente: tabla con cada archivo maestro esperado, su estado, última carga y filas procesadas.',
              'Historial de Ejecuciones: vista cronológica ampliada.',
            ],
          },
        ],
        images: [
          { src: IMG('10_2_monitor_etl.png'), caption: 'Pestaña "Batches Recientes"' },
          { src: IMG('10_2_detalle_corrida.png'), caption: 'Detalle de una corrida expandida' },
          { src: IMG('10_2_estado_fuentes.png'), caption: 'Pestaña "Estado por Fuente"' },
          { src: IMG('10_2_historial_ejecuciones.png'), caption: 'Pestaña "Historial de Ejecuciones"' },
        ],
      },
      {
        id: 'sec-10-3',
        number: '10.3',
        title: 'Ejecutar una carga manualmente',
        body: [
          'El botón "Ejecutar ETL" en la esquina superior derecha abre un diálogo de confirmación. Al pulsar "Ejecutar" se inicia el pipeline contra los archivos presentes en la carpeta de entrada.',
          {
            type: 'warn',
            text: 'Solo puede haber una carga en ejecución a la vez. Si intenta iniciar otra mientras hay una activa, el sistema le avisará.',
          },
        ],
        images: [{ src: IMG('10_3_carga_manual_confirmar.png'), caption: 'Diálogo de confirmación antes de ejecutar' }],
      },
      {
        id: 'sec-10-4',
        number: '10.4',
        title: 'Seguridad de los datos',
        body: [
          'Si se procesa el mismo archivo dos veces, el sistema no duplica información. Cada archivo se verifica por hash MD5; si no cambió, se marca "Sin cambios (mismo MD5)" y se ignora. Puede re-cargar un archivo con total seguridad.',
        ],
      },
      {
        id: 'sec-10-5',
        number: '10.5',
        title: 'Qué hacer si una carga falla',
        body: [
          {
            type: 'list',
            items: [
              'Abra el Monitor y ubique la corrida marcada como "Fallido".',
              'Expanda la tarjeta para ver el detalle del error.',
              'Causas frecuentes: archivo con codificación distinta de latin-1, separador distinto de ";", columna nueva agregada por SAP, o dato maestro que falta cargar primero.',
              'Corrija el archivo y vuelva a cargarlo o ejecute ETL manualmente.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sec-11',
    number: '11',
    title: 'Vistas y KPIs del sistema',
    body: ['La sección Administración incluye un bloque con indicadores clave del sistema que ayudan a entender el estado general.'],
    subsections: [
      {
        id: 'sec-11-1',
        number: '11.1',
        title: 'Indicadores superiores',
        body: [
          'En la parte superior del panel de Administración se muestran cuatro tarjetas:',
          {
            type: 'list',
            items: [
              'Usuarios activos: formato "activos/total" (ej. 4/4 si todos están activos).',
              'Vistas protegidas: vistas del sistema que no pueden eliminarse (ej. v_ventas, v_cxc, dim_*).',
              'Vistas personalizadas: vistas adicionales creadas sobre el modelo de datos.',
              'Directorios monitoreados: carpetas que el watcher está observando.',
            ],
          },
        ],
        images: [{ src: IMG('12_3_kpis_sistema.png'), caption: 'Tarjetas de KPIs del sistema en Administración' }],
      },
      {
        id: 'sec-11-2',
        number: '11.2',
        title: 'Vistas protegidas vs. personalizadas',
        body: [
          'Las vistas del sistema (Ventas, CxC, CxP, Inventario, Clientes, Productos, dimensiones) están protegidas y no pueden eliminarse, porque son la base de los reportes principales y de las integraciones externas.',
          'Las vistas personalizadas —cuando existen— pueden gestionarse vía API y solo pueden eliminarse por usuarios con permisos de superadministrador.',
        ],
      },
    ],
  },
  {
    id: 'sec-12',
    number: '12',
    title: 'Administración del sistema',
    body: ['Sección exclusiva para el superadministrador. Se accede desde el menú lateral → SISTEMA → Administración.'],
    subsections: [
      {
        id: 'sec-12-1',
        number: '12.1',
        title: 'Gestión de usuarios',
        body: [
          'La pestaña "Usuarios" muestra una tabla con Usuario, Nombre, Cédula, Rol, Estado, Último acceso y Acciones (Editar, Restablecer contraseña, Desactivar).',
          'La columna Cédula es nueva: muestra el documento de identidad asociado a cada usuario. Es el dato que el sistema usa para verificar la identidad cuando alguien hace un reset de contraseña self-service (ver 3.5). Si la cédula está vacía, ese usuario no podrá auto-restablecer su contraseña hasta que el superadministrador se la asigne.',
        ],
        images: [{ src: IMG('v2_admin_users_with_ci.png'), caption: 'Tabla de usuarios mostrando la columna Cédula' }],
      },
      {
        id: 'sec-12-1-1',
        number: '12.1.1',
        title: 'Crear un usuario',
        body: [
          'El botón "Nuevo Usuario" abre un formulario con los campos:',
          {
            type: 'list',
            items: [
              'Nombre de usuario (obligatorio, único).',
              'Cédula de identidad (obligatoria — habilita el reset self-service del usuario).',
              'Contraseña (obligatoria, con validaciones visibles: al menos 8 caracteres, una mayúscula, una minúscula, un número).',
              'Nombre completo.',
              'Rol (Superadministrador, Administrador o Analista).',
            ],
          },
          'El botón "Crear" permanece deshabilitado hasta que la contraseña cumpla todas las reglas.',
          {
            type: 'note',
            text: 'Cargue la cédula tal como aparece en el documento del usuario. Ese mismo valor es el que la persona deberá ingresar si más adelante usa "¿Olvidaste tu contraseña?".',
          },
        ],
        images: [
          { src: IMG('12_1_crear_usuario_vacio.png'), caption: 'Formulario vacío — botón "Crear" deshabilitado' },
          { src: IMG('12_1_crear_usuario_password_debil.png'), caption: 'Validación de contraseña débil (el botón sigue deshabilitado)' },
          { src: IMG('12_1_crear_usuario_valido.png'), caption: 'Formulario con datos válidos — botón "Crear" habilitado' },
          { src: IMG('12_1_crear_usuario_roles.png'), caption: 'Dropdown de roles disponibles' },
        ],
      },
      {
        id: 'sec-12-1-2',
        number: '12.1.2',
        title: 'Editar un usuario',
        body: [
          'El botón de lápiz abre el formulario de edición. El nombre de usuario no se puede cambiar; sí pueden modificarse Nombre completo, Cédula de identidad, Rol y, opcionalmente, una nueva contraseña.',
          'Si el usuario aún no tenía cédula registrada (cuentas creadas antes de esta funcionalidad), este es el lugar para asignársela y habilitarle el reset self-service.',
        ],
        images: [{ src: IMG('v2_admin_edit_user_with_ci.png'), caption: 'Diálogo "Editar Usuario" con el campo "Cédula de identidad"' }],
      },
      {
        id: 'sec-12-1-3',
        number: '12.1.3',
        title: 'Restablecer contraseña',
        body: [
          'El botón de llave abre un diálogo para generar una nueva contraseña en nombre del usuario. Se pide escribirla y confirmarla; ambas deben coincidir y cumplir las mismas reglas que al crear el usuario (≥8 caracteres, mayúscula, minúscula, número).',
          'Use esta opción cuando el usuario no pueda hacer el reset self-service (por ejemplo, porque no tiene cédula registrada o no la recuerda).',
        ],
        images: [{ src: IMG('v2_admin_reset_password.png'), caption: 'Diálogo "Restablecer contraseña" con las reglas de validación visibles' }],
      },
      {
        id: 'sec-12-1-4',
        number: '12.1.4',
        title: 'Desactivar un usuario',
        body: [
          'El botón de encendido pide confirmación antes de desactivar. Un usuario desactivado no puede iniciar sesión, pero su información y cuenta se conservan para una futura reactivación.',
          {
            type: 'note',
            text: 'No existe opción de "eliminar" usuario, solo desactivar. Esto preserva el historial y evita pérdida accidental de referencias.',
          },
        ],
        images: [{ src: IMG('12_1_desactivar_usuario.png'), caption: 'Confirmación de desactivación' }],
      },
      {
        id: 'sec-12-2',
        number: '12.2',
        title: 'Configuración del menú lateral',
        body: [
          'La pestaña "Configuración" permite, por cada rol (Superadministrador, Administrador, Analista), activar o desactivar la visibilidad de cada sección del sidebar (Principal, Finanzas, Operaciones, Maestros).',
          'Los cambios se aplican en tiempo real para todos los usuarios con ese rol.',
        ],
        images: [{ src: IMG('12_2_config_menu.png'), caption: 'Pestaña de Configuración del sidebar' }],
      },
      {
        id: 'sec-12-3',
        number: '12.3',
        title: 'Buenas prácticas',
        body: [
          {
            type: 'list',
            items: [
              'Mantenga al menos dos superadministradores activos para evitar quedar sin acceso.',
              'Cargue la cédula de identidad de cada usuario al crearlo: sin ella no podrán usar el reset self-service.',
              'Cambie las contraseñas periódicamente, especialmente las de superadministrador.',
              'Revise trimestralmente los usuarios sin acceso registrado y desactívelos.',
              'No asigne rol de administrador a personas que solo necesitan consultar datos; para eso está el rol de analista.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sec-13',
    number: '13',
    title: 'Preguntas frecuentes y solución de problemas',
    body: [],
    subsections: [
      {
        id: 'sec-13-1',
        number: '13.1',
        title: 'Problemas de acceso',
        body: [
          '«No puedo iniciar sesión»: verifique usuario/contraseña (distingue mayúsculas). Si olvidó su contraseña, use "¿Olvidaste tu contraseña?" en el login (sección 3.5) o pídale al superadministrador que la restablezca.',
          '«Veo la pantalla Acceso restringido»: su rol no tiene permiso para esa sección. Por ejemplo, un analista no puede ver el Monitor ETL ni Administración. Use el botón "Volver al dashboard" para regresar.',
          '«La sesión se cerró sola»: es normal, vuelva a ingresar con sus credenciales.',
        ],
        images: [{ src: IMG('13_1_acceso_restringido.png'), caption: 'Pantalla de acceso restringido' }],
      },
      {
        id: 'sec-13-2',
        number: '13.2',
        title: 'Problemas con los datos',
        body: [
          '«El Dashboard no muestra datos»: si acaba de instalar la Aplicación, aún no se han cargado archivos. Recargue con F5; si persiste, informe al administrador.',
          '«Los datos no están actualizados»: dependen de la última carga desde SAP. Consulte al administrador para revisar el Monitor ETL.',
          '«Veo caracteres extraños (ñ, tildes)»: el archivo fue convertido a un formato distinto. Debe mantenerse en latin-1.',
          '«Un cliente aparece como [PLACEHOLDER]»: el archivo maestro de clientes aún no se ha cargado; el nombre se actualizará al procesarlo.',
        ],
      },
      {
        id: 'sec-13-3',
        number: '13.3',
        title: 'Problemas de carga de datos (ETL)',
        body: [
          '«La carga se quedó en proceso por mucho tiempo»: si lleva más de 30 minutos, el sistema la marcará como fallida y podrá iniciar una nueva.',
          '«Ya hay una corrida activa»: espere a que termine, o si está colgada, revise el log del contenedor.',
          '«La carga falló»: revise el detalle. Causas comunes: codificación/separador del archivo, columna renombrada por SAP, o dato maestro faltante.',
          '«Sin cambios (mismo MD5)»: no es un error; significa que el archivo ya fue procesado y no hay nada nuevo que cargar.',
        ],
      },
      {
        id: 'sec-13-4',
        number: '13.4',
        title: 'Problemas de usuarios',
        body: [
          '«No puedo crear un usuario, el botón Crear está deshabilitado»: revise que la contraseña cumpla las cuatro reglas (8+ caracteres, mayúscula, minúscula, número) y que haya llenado usuario y contraseña.',
          '«Quiero eliminar un usuario pero no aparece la opción»: el sistema no permite eliminar, solo desactivar. La cuenta puede reactivarse en cualquier momento.',
        ],
      },
      {
        id: 'sec-13-5',
        number: '13.5',
        title: 'Problemas con el reset self-service',
        body: [
          '«El sistema dice ‘Datos no coinciden’ al intentar restablecer mi contraseña»: el usuario o la cédula no coinciden con lo registrado. Verifique que la cédula esté escrita exactamente como se la cargó el superadministrador (sin puntos, guiones ni espacios extra). Si persiste, pídale al superadministrador que revise su perfil en /administracion y le confirme la cédula que tiene cargada.',
          '«No tengo cédula registrada»: las cuentas creadas antes de esta funcionalidad pueden no tener cédula. Contacte al superadministrador para que se la asigne desde el panel de Administración (sección 12.1.2). Hasta entonces, el reset self-service no funcionará y deberá pedirle al superadministrador un reset manual (sección 12.1.3).',
          '«La nueva contraseña es rechazada»: debe cumplir las cuatro reglas (≥8 caracteres, mayúscula, minúscula, número). El formulario muestra cuál regla está fallando.',
        ],
      },
    ],
  },
]

function flatSearchIndex(sections: ManualSection[]): Array<{ id: string; number: string; title: string; text: string }> {
  const out: Array<{ id: string; number: string; title: string; text: string }> = []
  const walk = (s: ManualSection) => {
    const bodyText = s.body
      .map((b) => {
        if (typeof b === 'string') return b
        if (b.type === 'list') return b.items.join(' ')
        return b.text
      })
      .join(' ')
    out.push({ id: s.id, number: s.number, title: s.title, text: `${s.title} ${bodyText}` })
    s.subsections?.forEach(walk)
  }
  sections.forEach(walk)
  return out
}

function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
  const parts = text.split(re)
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="rounded bg-warning-200 text-warning-900 px-0.5">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

function Body({ body, query }: { body: ManualBlock[]; query: string }) {
  return (
    <>
      {body.map((item, i) => {
        if (typeof item === 'string') {
          return (
            <p key={i} className="text-sm md:text-base text-default-700 leading-relaxed mb-4">
              {highlight(item, query)}
            </p>
          )
        }
        if (item.type === 'list') {
          return (
            <ul key={i} className="list-disc pl-6 mb-4 space-y-1.5 text-sm md:text-base text-default-700">
              {item.items.map((it, j) => (
                <li key={j}>{highlight(it, query)}</li>
              ))}
            </ul>
          )
        }
        if (item.type === 'note') {
          return (
            <div
              key={i}
              className="mb-4 flex gap-3 rounded-lg border-l-4 border-primary-400 bg-primary-50 px-4 py-3"
            >
              <Info className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-default-700">
                <span className="font-semibold text-primary-700">Nota: </span>
                {highlight(item.text, query)}
              </p>
            </div>
          )
        }
        return (
          <div
            key={i}
            className="mb-4 flex gap-3 rounded-lg border-l-4 border-warning-400 bg-warning-50 px-4 py-3"
          >
            <ShieldAlert className="h-5 w-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-default-700">
              <span className="font-semibold text-warning-700">Importante: </span>
              {highlight(item.text, query)}
            </p>
          </div>
        )
      })}
    </>
  )
}

function Images({ images, onOpen }: { images?: ManualImage[]; onOpen: (src: string, caption?: string) => void }) {
  if (!images?.length) return null
  return (
    <div className="flex flex-col items-center gap-8 my-6">
      {images.map((img) => (
        <figure key={img.src} className="w-full max-w-4xl flex flex-col items-center">
          <div className="relative w-full overflow-hidden rounded-xl border border-default-200 shadow-sm bg-default-50 group">
            <img
              src={img.src}
              alt={img.caption ?? ''}
              className="w-full h-auto block cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
              loading="lazy"
              onClick={() => onOpen(img.src, img.caption)}
            />
            <button
              type="button"
              onClick={() => onOpen(img.src, img.caption)}
              className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Ampliar imagen"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              Ampliar
            </button>
          </div>
          {img.caption && (
            <figcaption className="mt-3 text-center text-xs text-default-500 italic max-w-3xl">
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

function Section({
  s,
  level = 0,
  query,
  onOpenImage,
}: {
  s: ManualSection
  level?: number
  query: string
  onOpenImage: (src: string, caption?: string) => void
}) {
  const HeadingTag = (level === 0 ? 'h2' : level === 1 ? 'h3' : 'h4') as keyof JSX.IntrinsicElements
  const headingClass =
    level === 0
      ? 'text-2xl md:text-3xl font-bold tracking-tight text-foreground border-b border-default-200 pb-3'
      : level === 1
        ? 'text-xl md:text-2xl font-semibold tracking-tight text-foreground'
        : 'text-base md:text-lg font-semibold text-foreground'
  const sectionSpacing = level === 0 ? 'mb-12 mt-2 first:mt-0' : level === 1 ? 'mb-8 mt-8' : 'mb-6 mt-5'

  if (level === 0) {
    return (
      <Card
        id={s.id}
        shadow="sm"
        className={`${sectionSpacing} scroll-mt-24 border border-default-200`}
      >
        <CardBody className="p-6 md:p-10">
          <HeadingTag className={`${headingClass} mb-5 flex items-baseline gap-3`}>
            <span className="text-primary font-mono">{s.number}</span>
            <span>{highlight(s.title, query)}</span>
          </HeadingTag>
          <Body body={s.body} query={query} />
          <Images images={s.images} onOpen={onOpenImage} />
          {s.subsections?.map((sub) => (
            <Section key={sub.id} s={sub} level={level + 1} query={query} onOpenImage={onOpenImage} />
          ))}
        </CardBody>
      </Card>
    )
  }

  return (
    <section id={s.id} className={`${sectionSpacing} scroll-mt-24`}>
      <HeadingTag className={`${headingClass} mb-4 flex items-baseline gap-3`}>
        <span className="text-primary font-mono">{s.number}</span>
        <span>{highlight(s.title, query)}</span>
      </HeadingTag>
      <Body body={s.body} query={query} />
      <Images images={s.images} onOpen={onOpenImage} />
      {s.subsections?.map((sub) => (
        <Section key={sub.id} s={sub} level={level + 1} query={query} onOpenImage={onOpenImage} />
      ))}
    </section>
  )
}

function Lightbox({ src, caption, onClose }: { src: string; caption?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 md:p-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
        onClick={onClose}
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
        Cerrar
      </button>
      <img
        src={src}
        alt={caption ?? ''}
        className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {caption && (
        <p className="mt-4 text-center text-sm text-white/80 max-w-3xl italic">{caption}</p>
      )}
    </div>
  )
}

export default function ManualPage() {
  const [query, setQuery] = useState('')
  const [lightbox, setLightbox] = useState<{ src: string; caption?: string } | null>(null)
  const [activeId, setActiveId] = useState<string>(SECTIONS[0]?.id ?? '')
  const [visited, setVisited] = useState<Set<string>>(() => new Set())
  const [progress, setProgress] = useState(0)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const mainRef = useRef<HTMLDivElement | null>(null)

  const index = useMemo(() => flatSearchIndex(SECTIONS), [])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return index.filter((e) => e.text.toLowerCase().includes(q)).slice(0, 30)
  }, [query, index])

  // Track scroll progress + active top-level section
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const scrollTop = doc.scrollTop || document.body.scrollTop
      const scrollHeight = doc.scrollHeight - doc.clientHeight
      const pct = scrollHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100)) : 0
      setProgress(pct)

      // Determine active top-level section: the last whose top is above the viewport center
      let current = SECTIONS[0]?.id ?? ''
      const trigger = window.innerHeight * 0.3
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top - trigger <= 0) current = s.id
        else break
      }
      setActiveId(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setVisited((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    }
  }, [])

  // Mark current section as visited on scroll
  useEffect(() => {
    if (activeId) {
      setVisited((prev) => {
        if (prev.has(activeId)) return prev
        const next = new Set(prev)
        next.add(activeId)
        return next
      })
    }
  }, [activeId])

  const tocItems = matches
    ? matches.map((e) => ({ id: e.id, number: e.number, title: e.title, topId: e.id.split('-').slice(0, 2).join('-') }))
    : SECTIONS.map((s) => ({ id: s.id, number: s.number, title: s.title, topId: s.id }))

  const content = (
    <>
      {/* Sticky reading-progress bar */}
      <div className="sticky top-0 z-40 -mx-4 md:-mx-0 mb-4 h-1 bg-default-100 overflow-hidden rounded-full">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-secondary"
          style={{ width: `${progress}%` }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ ease: 'linear', duration: 0.05 }}
        />
      </div>

      <PageHeader
        title="Manual de Usuario"
        description="Aplicación de integración y orquestación de datos para analítica gerencial en proyectos PET"
        actions={
          <div className="flex items-center gap-2">
            <Chip startContent={<BookOpen className="h-4 w-4" />} variant="flat" color="primary">
              {SECTIONS.length} capítulos
            </Chip>
            <Chip variant="flat" color="success" startContent={<CheckCircle2 className="h-4 w-4" />}>
              {visited.size}/{SECTIONS.length} visitados
            </Chip>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <Card shadow="sm" className="border border-default-200">
            <CardBody className="p-3">
              <Input
                size="sm"
                placeholder="Buscar en el manual..."
                value={query}
                onValueChange={setQuery}
                startContent={<Search className="h-4 w-4 text-default-400" />}
                isClearable
                onClear={() => setQuery('')}
                className="mb-3"
              />
              <nav className="text-sm space-y-1">
                {tocItems.map((e) => {
                  const isActive = activeId === e.topId
                  const wasVisited = visited.has(e.topId)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => jumpTo(e.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2 group ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium ring-1 ring-primary-200'
                          : 'hover:bg-default-100 text-default-700'
                      }`}
                    >
                      <span
                        className={`font-mono flex-shrink-0 text-xs ${
                          isActive ? 'text-primary-600' : 'text-primary'
                        }`}
                      >
                        {e.number}
                      </span>
                      <span className="truncate flex-1">{e.title}</span>
                      {wasVisited && !isActive && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success-500 flex-shrink-0" aria-label="Visitado" />
                      )}
                    </button>
                  )
                })}
                {matches && matches.length === 0 && (
                  <p className="text-xs text-default-400 px-3 py-2">Sin resultados para «{query}».</p>
                )}
              </nav>
            </CardBody>
          </Card>
        </aside>

        <main ref={mainRef} className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {SECTIONS.map((s, idx) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3, ease: 'easeOut' }}
                >
                  <Section
                    s={s}
                    query={query}
                    onOpenImage={(src, caption) => setLightbox({ src, caption })}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {lightbox && <Lightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} />}
    </>
  )

  if (isAuthenticated) {
    return <div>{content}</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#091B6B]/5 to-[#091B6B]/15">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-default-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/img/logo_380.png" alt="Proyectos PET" className="h-10 w-auto" />
            <div className="leading-tight">
              <p className="text-sm font-bold" style={{ color: '#091B6B' }}>Proyectos PET</p>
              <p className="text-xs text-default-500">Manual de usuario</p>
            </div>
          </div>
          <Button
            as={Link}
            to="/login"
            size="sm"
            startContent={<LogIn className="h-4 w-4" />}
            className="text-white font-semibold"
            style={{ backgroundColor: '#FF4E00' }}
          >
            Iniciar sesión
          </Button>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <Button as={Link} to="/login" variant="light" size="sm" startContent={<ArrowLeft className="h-4 w-4" />} className="mb-4">
          Volver al login
        </Button>
        {content}
      </div>
    </div>
  )
}
