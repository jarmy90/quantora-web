/**
 * Quantora · Diccionario de español (es-ES).
 *
 * Paridad exacta de claves con el catálogo en-US de ./index.ts. English is
 * the safe per-key fallback, so a rendered document never mixes languages.
 * Reglas editoriales: no traducir Quantora, MetaTrader 5, Algo Trading,
 * Profit Factor, Quantora Score, nombres de estrategias, símbolos, timeframes,
 * versiones, rutas ni nombres de archivo EX5/SET. Conservar {placeholders}.
 */

export const esES: Record<string, string> = {
  'nav.howItWorks': 'Cómo funciona',
  'nav.strategies': 'Estrategias',
  'nav.install': 'Cómo instalarlo',
  'nav.trustRisk': 'Confianza y riesgo',
  'nav.explore': 'Explorar estrategias',
  'nav.home': 'Inicio',
  'nav.myAccount': 'Mi cuenta',
  'nav.catalog': 'Catálogo',
  'nav.dashboard': 'Panel',
  'nav.createAccount': 'Crear cuenta',
  'nav.mockEnvironment': 'ENTORNO DE PRUEBAS',
  'nav.backCatalog': '← Catálogo',
  'nav.signIn': 'Iniciar sesión',
  'nav.openMenu': 'Abrir menú de navegación',
  'nav.closeMenu': 'Cerrar menú de navegación',
  'nav.language': 'Idioma',

  'home.eyebrow': 'Expert Advisors, explicados con evidencia',
  'home.heroTitle': 'Encuentra un Expert Advisor',
  'home.heroAccent': 'compruébalo.',
  'home.heroBody':
    'Compara estrategias publicadas a través de resultados históricos, riesgo, costes de trading y una Quantora Score coherente, y aprende cómo encaja cada EA en MetaTrader 5.',
  'home.browse': 'Explorar estrategias',
  'home.seeHow': 'Cómo funciona',
  'home.fact1': '3 estrategias publicadas',
  'home.fact2': 'Resultados históricos',
  'home.fact3': 'Transparencia sobre riesgo y costes',
  'home.fact4': 'Sin necesidad de programar',
  'home.realStrategies': 'Tres estrategias publicadas',
  'home.realStrategiesBody':
    'Explora tres sistemas publicados y basados en reglas, con resultados históricos, métricas de riesgo, costes, limitaciones y una Quantora Score calculada siempre de la misma manera.',
  'home.viewStrategy': 'Ver estrategia',
  'home.compare': 'Comparar estrategias',
  'home.compareEyebrow': 'Un método de evaluación coherente',
  'home.compareTitle': 'La misma evaluación estructurada para cada estrategia.',
  'home.compareBody':
    'Cada estrategia publicada se evalúa con la misma metodología estructurada, de modo que los resultados históricos y las métricas de riesgo pueden compararse directamente.',
  'home.waitlistEyebrow': 'Acceso anticipado',
  'home.waitlistTitle': 'Sé el primero en saber cuándo una estrategia esté disponible.',
  'home.waitlistBody':
    'Únete a la lista de acceso anticipado de Quantora para recibir novedades sobre la disponibilidad de los productos.',
  'home.getAccessUpdates': 'Recibir novedades de disponibilidad',
  'home.waitlistNote':
    'Las novedades aparecerán en tu cuenta de Quantora. En esta página no se recoge ningún dato todavía.',
  'home.workflow': 'Una forma coherente de evaluar estrategias',
  'home.workflowTitle': 'Menos promesas. Más evidencia.',
  'home.workflowIntro':
    'Quantora evalúa cada estrategia publicada con la misma metodología estructurada de backtesting y presenta el registro histórico completo: resultado neto, Profit Factor, drawdown, número de operaciones, frecuencia, costes y limitaciones.',
  'home.stepAnalyze': 'Analizar',
  'home.stepAnalyzeBody':
    'El registro histórico de cada estrategia se procesa con la misma metodología estructurada: operaciones cerradas, curva de capital, Profit Factor, drawdown, frecuencia, estabilidad y costes disponibles.',
  'home.stepFilter': 'Filtrar',
  'home.stepFilterBody':
    'Cada estrategia se evalúa con los mismos criterios de publicación. Lo que aparece en el catálogo está aprobado para su publicación y muestra su evidencia.',
  'home.stepShow': 'Mostrar el cuadro completo',
  'home.stepShowBody':
    'Potencial y riesgo se presentan juntos: curva de capital, métricas, Quantora Score y limitaciones, para que la decisión siga siendo tuya.',
  'home.workflowClose':
    'No prometemos rentabilidad. Construimos una forma más clara y rigurosa de evaluar estrategias.',

  'trust.eyebrow': 'Transparencia por diseño',
  'trust.title': 'El cuadro completo, no solo las mejores operaciones.',
  'trust.body':
    'Quantora presenta el rendimiento histórico junto con el drawdown, el número de operaciones, los costes, el periodo analizado y las limitaciones conocidas. Los backtests históricos, el monitoreo en demo y los resultados en cuenta real están claramente separados por origen. Los resultados históricos son evidencia para la evaluación, no una promesa de rentabilidad futura.',

  'common.demoReturn': 'Rentabilidad en demo',
  'common.risk': 'Riesgo',
  'common.maxDD': 'Max DD',
  'common.mockDemo': 'Catálogo de estrategias',
  'common.notFound': 'Página no encontrada',

  'catalog.title': 'Encuentra tu señal.',
  'catalog.body':
    'Compara sistemas transparentes y basados en reglas, diseñados para distintos mercados y perfiles de riesgo.',
  'catalog.eyebrow': 'Catálogo de estrategias',
  'catalog.published': 'Tres estrategias publicadas',
  'catalog.publishedStrategy': 'Estrategia publicada',
  'catalog.historicalBacktest': 'Backtest histórico',
  'catalog.comingSoon': 'Acceso anticipado',
  'catalog.commercialOpeningSoon': 'Acceso anticipado',
  'catalog.notListed': 'No listada',
  'catalog.paused': 'En pausa',
  'catalog.deprecated': 'Obsoleta',
  'catalog.available': 'Disponible',

  'detail.eyebrow': 'Estrategia publicada · Backtest histórico',
  'detail.period': 'Periodo',
  'detail.maxDrawdown': 'Drawdown máximo',
  'detail.winRate': 'Tasa de acierto',
  'detail.totalTrades': 'Operaciones totales',
  'detail.dataStatus': 'Estado de los datos',
  'detail.score': 'Quantora Score',
  'detail.scoreExplanation':
    'Puntuación comparativa calculada de forma coherente a partir de la evidencia histórica disponible para cada estrategia.',
  'detail.evidenceConfidence': 'Confianza de la evidencia: {pct}%',
  'detail.profitFactor': 'Profit Factor',
  'detail.frequency': 'Frecuencia',
  'detail.costs': 'Costes',
  'detail.netResult': 'Resultado neto',
  'detail.market': 'Mercado',
  'detail.instrument': 'Instrumento',
  'detail.version': 'Versión',
  'detail.howItWorks': 'Cómo funciona',
  'detail.limitations': 'Limitaciones',
  'detail.researchNote':
    'Backtest histórico: analiza resultados pasados; no representa trading en vivo ni abre órdenes reales.',
  'detail.freqPerMonth': 'al mes',
  'detail.equityCurve': 'Curva de capital',
  'detail.drawdownValue': 'Drawdown',
  'detail.backtestLabel': 'Backtest histórico',
  'detail.notFound': 'Estrategia no encontrada',
  'detail.notFoundBody':
    'La estrategia que buscas no existe. Explora el catálogo para ver los sistemas disponibles.',
  'detail.backCatalog': '← Volver al catálogo',
  'detail.historicalBacktest': 'Backtest histórico',
  'detail.resultsInPoints': 'Resultados en puntos',
  'detail.closedTradeDrawdown': 'Drawdown sobre operaciones cerradas',
  'detail.drawdownNote':
    'Drawdown de pico a valle calculado sobre el capital de las operaciones cerradas.',
  'detail.evidence': 'Evidencia',
  'detail.evidenceClosedTrade':
    'Backtest histórico sobre XAUUSD M15. Los resultados se expresan en puntos e incluyen 203 operaciones cerradas. Una posición permaneció abierta al final de la prueba y se excluye de las métricas de operaciones cerradas. La curva de capital y el drawdown se calculan a nivel de operación cerrada, no sobre el capital intradiario de la cuenta.',
  'detail.closedTradeEquity': 'Capital sobre operaciones cerradas · puntos',
  'detail.openPositionsAtEnd': 'Posiciones abiertas al final',
  'detail.expectancy': 'Esperanza matemática',
  'detail.ptsPerTrade': 'pts/operación',
  'card.backtestLabel': 'Backtest histórico',
  'card.costsNotIncluded':
    'Los resultados del backtest excluyen comisión, spread, deslizamiento y swap.',
  'detail.productState': 'Disponibilidad',
  'detail.productId': 'Producto',
  'detail.commercialDownload': 'Descarga comercial',
  'detail.commercialDownloadEnabled': 'Activada',
  'detail.commercialDownloadDisabled': 'No activada',
  'detail.viewMethodology': 'Ver metodología',
  'detail.earlyAccess': 'Acceso anticipado',
  'detail.earlyAccessTitle': 'Sé el primero en saber cuándo una estrategia esté disponible.',
  'detail.earlyAccessBody':
    'Quantora está preparando el acceso comercial a sus estrategias publicadas. Crea una cuenta y las novedades aparecerán allí.',
  'detail.earlyAccessNote':
    'En esta página no se recoge ningún dato. El acceso comercial aún no está abierto: no hay compra, alquiler ni descarga disponible.',
  'detail.getAccessUpdates': 'Recibir novedades de disponibilidad',
  'detail.tradingCosts': 'Costes de trading',
  'detail.costsNotIncludedCopy':
    'Este backtest no incluye comisión, spread, deslizamiento ni swap. Por lo tanto, los resultados reales podrían ser inferiores.',
  'detail.costsIncludedCopy':
    'Los resultados incluyen los datos de comisión disponibles. El resto de costes del bróker solo se incluyen cuando la fuente los facilita.',
  'detail.tradingCostsMethodology':
    'Los costes de trading se muestran exactamente tal como los aporta cada backtest. Cuando no se incluyen comisión, spread, deslizamiento o swap, Quantora lo indica en la ficha de la estrategia.',
  'detail.monitorEyebrow': 'Monitoreo en demo',
  'detail.monitorNotConnected': 'Aún sin conectar',
  'detail.monitorBody':
    'Para esta estrategia está prevista una vista de monitoreo en cuenta demo claramente etiquetada. Los resultados del backtest histórico y el monitoreo en demo seguirán siendo independientes.',
  'detail.monitorStatus': 'Estado',
  'detail.monitorBroker': 'Bróker',
  'detail.monitorBalance': 'Saldo',
  'detail.monitorEquity': 'Capital',
  'detail.monitorTrades': 'Operaciones',
  'detail.monitorDrawdown': 'Drawdown observado',
  'detail.monitorLastUpdate': 'Última actualización',
  'detail.monitorNotAvailable': 'No disponible',
  'detail.monitorLegend': 'Backtest ≠ Monitoreo en demo ≠ Resultados en cuenta real',

  'dashboard.eyebrow': 'Vista previa del área personal',
  'dashboard.title': 'Tu espacio de trabajo.',
  'dashboard.body':
    'Tu área personal organizará el interés en estrategias y el acceso futuro, sin mezclar resultados de investigación con la actividad de la cuenta.',
  'dashboard.demo':
    'El acceso a la cuenta está en preparación. No hay compras, descargas ni licencias activas.',
  'dashboard.licenses': 'Estado del producto',
  'dashboard.downloads': 'Descargas',
  'dashboard.history': 'Actividad reciente',
  'dashboard.status': 'Estado',
  'dashboard.expires': 'Caduca',
  'dashboard.type': 'Modelo',
  'dashboard.name': 'Nombre',
  'dashboard.format': 'Formato',
  'dashboard.size': 'Tamaño',
  'dashboard.date': 'Fecha',
  'dashboard.event': 'Evento',
  'dashboard.detail': 'Detalle',
  'dashboard.product': 'Producto',
  'dashboard.monitor': 'Monitoreo en demo',
  'dashboard.emptyLicenses':
    'Aún no hay productos. Explora el catálogo para ver lo que se está preparando.',
  'dashboard.emptyDownloads': 'Aún no hay descargas disponibles.',
  'dashboard.emptyHistory': 'No hay actividad registrada.',
  'dashboard.viewStrategy': 'Ver',
  'dashboard.accountAccess': 'Acceso a la cuenta',
  'dashboard.accountAccessBody':
    'El acceso seguro y la identificación del cliente se introducirán en una fase posterior.',
  'dashboard.notEnabledYet': 'Aún no activado',

  'legal.eyebrow': 'Legal / BORRADOR',
  'legal.review':
    '⚠ BORRADOR — Solo para demostración. Esta página es una plantilla y no ha sido revisada ni aprobada por un asesor jurídico. Debe ser revisada por un profesional cualificado antes de utilizarse o publicarse en producción.',
  'legal.updated': 'Última actualización',
  'legal.home': '← Inicio',
  'legal.financial':
    'Nada de lo publicado en este sitio constituye asesoramiento financiero, de inversión o de trading. Todas las métricas y simulaciones son datos simulados/demo para la demostración del producto y no representan ni garantizan resultados futuros. Operar conlleva un riesgo sustancial de pérdida.',
  'legal.placeholderSection':
    '(Sección provisional: contenido pendiente de completar y revisar por asesoría jurídica.)',

  'footer.demo': 'Los resultados históricos no garantizan resultados futuros · No es asesoramiento financiero',
  'footer.mock': 'Cifras SOLO SIMULADAS / DEMO · No es asesoramiento de inversión',
  'footer.detail':
    'DATOS SIMULADOS / DEMO · La simulación histórica no es indicativa de resultados futuros · No es asesoramiento financiero',
  'footer.tagline':
    'Descubrimiento y evaluación de estrategias algorítmicas · MetaTrader 5',
  'footer.product': 'Producto',
  'footer.account': 'Cuenta',
  'footer.legal': 'Legal',
  'footer.legalDisclaimer': 'Aviso legal',
  'footer.legalTerms': 'Términos de uso',
  'footer.legalPrivacy': 'Política de privacidad',
  'footer.legalRisk': 'Divulgación de riesgos',
  'footer.rights': 'Los resultados históricos no garantizan resultados futuros. No es asesoramiento financiero.',

  'seo.homeDescription':
    'Quantora evalúa estrategias de trading basadas en reglas mediante backtesting estructurado, mostrando claramente rendimiento, riesgo y limitaciones.',
  'seo.catalogDescription':
    'Compara estrategias transparentes y basadas en reglas, diseñadas para distintos mercados y perfiles de riesgo.',
  'seo.dashboardDescription':
    'Vista previa ilustrativa para clientes. No hay productos, licencias ni pagos activos.',
  'seo.strategyDescription':
    'Backtest histórico, rendimiento, riesgo y limitaciones de una estrategia publicada en Quantora.',

  'auth.eyebrow': 'Cuenta de Quantora',
  'auth.legalNote': 'Al continuar aceptas nuestra',
  'auth.privacy': 'Política de privacidad',
  'auth.terms': 'Términos de uso',
  'auth.or': 'o',
  'auth.loading': 'Espera un momento…',
  'auth.notConfiguredTitle': 'La autenticación aún no está configurada',
  'auth.notConfiguredBody':
    'Quantora funciona sin un proyecto de autenticación activo en este entorno. Añade VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para activar el registro y el inicio de sesión.',
  'auth.backHome': '← Volver al inicio',
  'auth.createAccount': 'Crear cuenta',

  'login.title': 'Bienvenido de nuevo',
  'login.body':
    'Inicia sesión en tu espacio de Quantora para seguir estrategias y gestionar tu acceso: con calma y con claridad.',
  'login.emailLabel': 'Correo electrónico',
  'login.passwordLabel': 'Contraseña',
  'login.submit': 'Iniciar sesión',
  'login.registerLink': '¿Nuevo aquí? Crea una cuenta',
  'login.forgotLink': '¿Olvidaste tu contraseña?',
  'login.success': 'Sesión iniciada. Te llevamos a tu cuenta…',

  'register.title': 'Crea tu cuenta',
  'register.body':
    'Tu espacio para descubrir, seguir y gestionar estrategias con claridad. Sin compromisos por ahora.',
  'register.displayNameLabel': 'Nombre para mostrar (opcional)',
  'register.emailLabel': 'Correo electrónico',
  'register.passwordLabel': 'Contraseña',
  'register.passwordHint': 'Al menos 8 caracteres.',
  'register.submit': 'Crear cuenta',
  'register.loginLink': '¿Ya tienes cuenta? Inicia sesión',
  'register.checkYourEmail': 'Revisa tu bandeja de entrada',
  'register.checkYourEmailBody':
    'Te hemos enviado un enlace de confirmación a tu correo. Una vez confirmado, podrás iniciar sesión.',
  'register.success': 'Cuenta creada. Revisa tu correo para confirmarla.',

  'forgot.title': 'Restablece tu contraseña',
  'forgot.body':
    'Introduce tu correo y te enviaremos un enlace seguro para elegir una nueva contraseña.',
  'forgot.emailLabel': 'Correo electrónico',
  'forgot.submit': 'Enviar enlace de restablecimiento',
  'forgot.backToLogin': '← Volver a iniciar sesión',
  'forgot.sentTitle': 'Revisa tu bandeja de entrada',
  'forgot.sentBody': 'Si existe una cuenta con ese correo, el enlace de restablecimiento va en camino.',
  'forgot.error': 'Algo salió mal. Inténtalo de nuevo.',

  'reset.title': 'Elige una nueva contraseña',
  'reset.body': 'Tu enlace de restablecimiento es válido. Elige una contraseña segura para continuar.',
  'reset.passwordLabel': 'Nueva contraseña',
  'reset.passwordHint': 'Al menos 8 caracteres.',
  'reset.submit': 'Actualizar contraseña',
  'reset.success': 'Contraseña actualizada. Ya puedes iniciar sesión.',
  'reset.backToLogin': '← Volver a iniciar sesión',

  'account.title': 'Tu cuenta',
  'account.welcome': 'Bienvenido de nuevo',
  'account.emailVerified': 'Correo verificado',
  'account.emailUnverified': 'Correo aún sin verificar',
  'account.signOut': 'Cerrar sesión',
  'account.eyebrow': 'Cuenta',
  'account.strategies': 'Tus estrategias',
  'account.strategiesEmpty': 'Todavía no tienes estrategias activas.',
  'account.licenses': 'Licencias',
  'account.licensesEmpty': 'No hay licencias disponibles.',
  'account.billing': 'Facturación',
  'account.billingEmpty': 'La facturación estará disponible cuando se activen los productos.',
  'account.accessNote': 'Productos, licencias y pagos aún no están activos.',
  'account.returned': 'Volviendo a donde estabas…',
  'account.signInCta': 'Inicia sesión para acceder a tu cuenta',

  'callback.invalid': 'El enlace de confirmación no es válido o ha caducado. Inténtalo de nuevo.',
  'callback.processing': 'Confirmando tu cuenta…',

  'easy.eyebrow': 'Easy Start',
  'easy.title': 'Instala tu estrategia en MetaTrader 5 en 3 sencillos pasos.',
  'easy.body':
    'Sin necesidad de programar. Quantora te guía desde la descarga hasta la primera prueba segura en una cuenta demo.',
  'easy.cta': 'Ver los 3 pasos',
  'easy.trustNoCoding': 'Sin necesidad de programar',
  'easy.trustDemo': 'Empieza con una cuenta demo',
  'easy.trustMT5': 'Compatible con MetaTrader 5',
  'easy.warning':
    'La guía de instalación explica solo la configuración técnica. No garantiza rendimiento, rentabilidad ni idoneidad.',
  'easy.downloadTitle': 'Descarga el paquete de tu estrategia',
  'easy.downloadBody':
    'Tu futuro paquete de Quantora incluirá el Expert Advisor compilado y los materiales de instalación asociados a tu acceso.',
  'easy.packageEx5': 'tu-estrategia.ex5',
  'easy.packageSet': 'configuracion-recomendada.set',
  'easy.packageGuide': 'guia-de-inicio-rapido',
  'easy.settingsNote': 'El archivo de configuración se incluye solo cuando está disponible para esa estrategia.',
  'easy.noCompile':
    'Para la instalación estándar de Quantora no se necesita editar código fuente ni compilar nada.',
  'easy.downloadCta': 'La descarga estará disponible con un producto y una licencia activos.',
  'easy.installTitle': 'Coloca la estrategia en MetaTrader 5',
  'easy.installIntro': 'Solo tienes que copiar archivos en la carpeta correcta: nunca tocas código.',
  'easy.installStep1': 'Abre MetaTrader 5.',
  'easy.installStep2': 'Selecciona File.',
  'easy.installStep3': 'Selecciona Open Data Folder.',
  'easy.installStep4': 'Abre MQL5.',
  'easy.installStep5': 'Abre Experts.',
  'easy.installStep6': 'Copia el archivo .ex5 en la carpeta Experts.',
  'easy.installStep7': 'Vuelve a MetaTrader 5.',
  'easy.installStep8': 'Actualiza los Expert Advisors en el Navigator.',
  'easy.installPath': 'MetaTrader 5 → File → Open Data Folder → MQL5 → Experts',
  'easy.installTroubleTitle': 'Si la estrategia no aparece',
  'easy.installTrouble1': 'Actualiza los Expert Advisors.',
  'easy.installTrouble2': 'Reinicia MetaTrader 5.',
  'easy.installTrouble3': 'Confirma que el archivo .ex5 está dentro de MQL5/Experts.',
  'easy.testTitle': 'Ponla en un gráfico y empieza en demo',
  'easy.testIntro': 'Pruébalo todo en una cuenta demo claramente identificada antes que nada.',
  'easy.testStep1': 'Abre el instrumento que indica la estrategia.',
  'easy.testStep2': 'Selecciona el timeframe requerido.',
  'easy.testStep3': 'Arrastra el Expert Advisor desde el Navigator hasta el gráfico.',
  'easy.testStep4': 'Carga el archivo .set recomendado cuando se proporcione.',
  'easy.testStep5': 'Permite el trading algorítmico cuando sea necesario.',
  'easy.testStep6': 'Activa Algo Trading en MetaTrader 5.',
  'easy.testStep7': 'Confirma que el EA se está ejecutando.',
  'easy.testStep8': 'Pruébalo primero en una cuenta demo claramente identificada.',
  'easy.checklistTitle': 'Lista de verificación',
  'easy.checklistNavigator': 'Estrategia visible en Navigator',
  'easy.checklistInstrument': 'Instrumento correcto',
  'easy.checklistTimeframe': 'Timeframe correcto',
  'easy.checklistSettings': 'Configuración cargada',
  'easy.checklistAlgo': 'Algo Trading activado',
  'easy.checklistDemo': 'Cuenta demo confirmada',
  'easy.demoWarning':
    'No empieces con una cuenta real. Aprende primero la estrategia, su configuración y su comportamiento en demo.',
  'easy.demoLabel': 'Cuenta demo',
  'easy.seeSteps': 'Ver cómo funciona la instalación',

  'easy.installBlockEyebrow': 'Instalación sencilla',
  'easy.installBlockTitle': 'Sin necesidad de programar.',
  'easy.installBlockBody':
    'Recibe un Expert Advisor de MetaTrader 5 compilado y sigue la guía visual cuando el producto esté disponible.',
  'easy.homeEyebrow': 'De la estrategia a MT5',
  'easy.homeTitle': 'De la descarga a la demo, en tres pasos claros.',
  'easy.homeBody':
    'Quantora elimina la fricción técnica. Sigue tres pasos claros, usa el EA compilado y empieza con una cuenta demo.',
  'easy.homeStep1': 'Descargar',
  'easy.homeStep2': 'Instalar',
  'easy.homeStep3': 'Empezar en demo',
  'easy.homeCta': 'Ver cómo funciona',
  'easy.accountEyebrow': 'Guía de instalación',
  'easy.accountBody':
    'Aprende cómo se instalan las estrategias de Quantora antes de que existan productos y descargas.',
  'easy.accountCta': 'Abrir Easy Start',
  'easy.compactCta': 'Ver la guía de instalación',
  'easy.compactStep1Title': 'Instalar',
  'easy.compactStep1Body': 'Coloca el archivo EX5 suministrado en MetaTrader 5.',
  'easy.compactStep2Title': 'Configurar',
  'easy.compactStep2Body':
    'Abre el mercado y el timeframe requeridos y carga la configuración recomendada.',
  'easy.compactStep3Title': 'Empezar en demo',
  'easy.compactStep3Body':
    'Pon el EA en el gráfico, activa Algo Trading y pruébalo primero en una cuenta demo.',
  'easy.previewNote': 'Esta guía es informativa. Todavía no hay ningún producto ni licencia activos.',
  'easy.marketTitle': 'Abre el mercado y el timeframe que usa tu estrategia',
  'easy.marketBody':
    'Cada estrategia opera en un mercado concreto y, cuando se facilita, un timeframe. Abre exactamente lo que especifica tu estrategia: no se asume nada.',
  'easy.marketStep1':
    'Abre el símbolo que indica tu estrategia (consulta la ficha de la estrategia).',
  'easy.marketStep2': 'Selecciona el timeframe requerido cuando esté especificado para la estrategia.',
  'easy.marketStep3': 'Si la ficha no indica timeframe, sigue las notas de configuración propias de la estrategia.',
  'easy.marketTableStrategy': 'Estrategia',
  'easy.marketTableMarket': 'Mercado',
  'easy.marketTableInstrument': 'Instrumento',
  'easy.marketTableTimeframe': 'Timeframe',
  'easy.marketInDetails': 'Se muestra en la ficha de la estrategia',
  'easy.marketNote':
    'Los timeframes se muestran solo cuando se publican en los datos de cada estrategia. Aquí no se inventa ningún mercado ni timeframe.',

  'monitor.statusNotConnected': 'Aún sin conectar',
  'monitor.statusConnecting': 'Conectando…',
  'monitor.statusLiveDemo': 'Demo activa',
  'monitor.statusStale': 'Datos desactualizados',
  'monitor.statusOffline': 'Sin conexión',
  'monitor.body':
    'Para esta estrategia está preparado un módulo de monitoreo en demo claramente etiquetado. Todavía no hay ninguna conexión real con MetaTrader, por lo que nada se reporta como en vivo.',
  'monitor.unavailableReason': 'No hay datos de monitoreo en demo para esta estrategia.',
  'monitor.disclaimer':
    'Una cuenta demo es un entorno de trading simulado. El monitoreo en demo no es un resultado de cuenta real, una garantía ni un consejo de inversión.',
};