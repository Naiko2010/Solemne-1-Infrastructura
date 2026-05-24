# Atribuciones y Créditos

## 🙏 Agradecimientos

### Librerías y Frameworks Backend

#### FastAPI & Python
- **FastAPI** v0.109.0 - [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/)
  - Framework web moderno y de alto rendimiento para construir APIs REST
  - Documentación automática con Swagger/OpenAPI
- **Uvicorn** v0.27.0 - [https://www.uvicorn.org/](https://www.uvicorn.org/)
  - Servidor ASGI ultra-rápido para ejecutar aplicaciones Python
- **Pydantic** v2.5.3 - [https://docs.pydantic.dev/](https://docs.pydantic.dev/)
  - Validación de datos y serialización con type hints

#### Autenticación y Seguridad
- **Supabase SDK** v2.4.0 - [https://supabase.com/](https://supabase.com/)
  - Backend open-source como alternativa a Firebase
  - PostgreSQL, autenticación, almacenamiento en tiempo real
- **python-jose** v3.3.0 - [https://github.com/mpdavis/python-jose](https://github.com/mpdavis/python-jose)
  - Implementación Python del estándar JOSE (JSON Web Tokens)
  - Validación de JWT tokens
- **cryptography** - [https://cryptography.io/](https://cryptography.io/)
  - Librerías de criptografía para manejo seguro de tokens

#### Utilidades
- **python-dotenv** - Cargar variables de entorno desde `.env`
- **pytz & tzdata** - Manejo de zonas horarias (timezone: America/Santiago)
- **SQLAlchemy** - ORM para interacción con PostgreSQL (via Supabase)

### Librerías y Frameworks Frontend

#### React & Vite
- **React** v19.2 - [https://react.dev/](https://react.dev/)
  - Librería declarativa para construir interfaces de usuario
  - Hooks y composición de componentes
- **Vite** v8.0 - [https://vitejs.dev/](https://vitejs.dev/)
  - Build tool ultrarrápido con hot module replacement
  - Mejor experiencia de desarrollo que Webpack
- **@vitejs/plugin-react** - Soporte JSX para Vite

#### Supabase Client
- **@supabase/supabase-js** - [https://supabase.com/docs/reference/javascript](https://supabase.com/docs/reference/javascript)
  - Cliente JavaScript oficial para Supabase
  - Autenticación, queries en tiempo real

#### Testing
- **Vitest** - [https://vitest.dev/](https://vitest.dev/)
  - Test runner rápido y compatible con Vite
  - Reemplazo moderno para Jest
- **@testing-library/react** - Utilidades para testing de componentes React
- **@testing-library/user-event** - Simulación de eventos de usuario

#### Linting y Formato
- **ESLint** - [https://eslint.org/](https://eslint.org/)
  - Análisis estático de código JavaScript
  - Detección de errores y buenas prácticas
- **eslint-config-react-app** - Configuración ESLint para aplicaciones React

---

## 🏗️ Arquitectura y Diseño

### Patrones Implementados
- **REST API** con endpoints bien definidos
- **JWT-based Authentication** para seguridad
- **Role-Based Access Control (RBAC)** para autorización
- **Component-Based Architecture** en frontend
- **Custom Hooks** para lógica reutilizable
- **Service Layer Pattern** en backend

### Inspiración y Referencias
- **12-Factor App** - [https://12factor.net/](https://12factor.net/)
  - Principios para aplicaciones modernas y escalables
- **REST API Best Practices** - [https://restfulapi.net/](https://restfulapi.net/)
- **React Patterns** - [https://react.dev/reference](https://react.dev/reference)

---

## 📚 Documentación y Recursos

### Documentación Oficial Utilizada
- **FastAPI Documentation** - [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/)
- **React Documentation** - [https://react.dev/](https://react.dev/)
- **Vite Guide** - [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
- **Supabase Guides** - [https://supabase.com/docs/guides](https://supabase.com/docs/guides)
- **PostgreSQL Documentation** - [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)

### Comunidades y Contribuyentes
- **Stack Overflow** - Solución de problemas específicos
- **GitHub Discussions** - Comunidades de proyectos open-source
- **FastAPI Discord** - Comunidad de desarrolladores FastAPI
- **React Community** - Recursos y mejores prácticas

---

## 🎨 UI/UX e Inspiración Visual

### Principios de Diseño
- **Diseño Responsive** - Mobile-first approach
- **Accesibilidad** - WCAG 2.1 AA standards
- **Usabilidad** - Interfaz intuitiva para usuarios no técnicos
- **Consistencia** - Design system uniforme

### Herramientas de Diseño Utilizadas
- **CSS3** - Animaciones GPU-aceleradas
- **Flexbox & Grid** - Layouts modernos
- **Gradientes y Sombras** - Profundidad visual

---

## 🔐 Seguridad y Compliance

### Referencias de Seguridad
- **OWASP Top 10** - [https://owasp.org/www-project-top-ten/](https://owasp.org/www-project-top-ten/)
  - Protección contra vulnerabilidades comunes
- **NIST Cybersecurity Framework** - [https://www.nist.gov/cyberframework](https://www.nist.gov/cyberframework)
- **JWT Security Best Practices** - [https://tools.ietf.org/html/rfc7519](https://tools.ietf.org/html/rfc7519)

### Librerías de Seguridad
- **cryptography** - Criptografía robusta
- **python-jose** - Manejo seguro de tokens
- **Supabase RLS** - Row-Level Security en PostgreSQL

---

## 📊 Datos y KPIs

### Fuentes de Datos
- **Bases de Datos:** PostgreSQL (via Supabase)
- **Timezone Reference:** IANA Time Zone Database (tzdata)
- **Fórmulas Financieras:** Estándares contables chilenos

### Localización
- **Formato Moneda:** CLP (Peso Chileno)
- **Idioma:** Español (Chile)
- **Timezone:** America/Santiago

---

## 🛠️ Herramientas de Desarrollo

### Control de Versiones
- **Git** - [https://git-scm.com/](https://git-scm.com/)
- **GitHub** - Repositorio y colaboración

### Contenedorización
- **Docker** - [https://www.docker.com/](https://www.docker.com/)
  - Containerización de aplicaciones
  - Reproducibilidad de ambientes
- **Docker Compose** - Orquestación local de servicios

### Package Managers
- **pip** - Python package manager
- **npm** - Node.js package manager

### CI/CD (Recomendado)
- **GitHub Actions** - Automation y testing
- **Vercel** - Deploy automático de frontend
- **Railway/Render** - Deploy de backend

---

## 🌟 Contribuidores

### Equipo Principal
- **SibaGestion Team** - Desarrollo y mantenimiento
- **Ingeniería de Software 2 (INGSW2)** - Contexto educativo

### Colaboradores Potenciales
Se agradece a cualquiera que contribuya con:
- Bug reports y fixes
- Mejoras de documentación
- Nuevas features
- Testing

---

## 📜 Licencias de Dependencias

### Backend Licenses
```
FastAPI              → MIT License
Uvicorn              → BSD License
Pydantic             → MIT License
Supabase SDK         → Apache 2.0
python-jose          → MIT License
cryptography         → Apache 2.0
SQLAlchemy           → MIT License
python-dotenv        → BSD License
pytz & tzdata        → MIT License
```

### Frontend Licenses
```
React                → MIT License
Vite                 → MIT License
Supabase JS          → Apache 2.0
Vitest               → MIT License
@testing-library/*   → MIT License
ESLint               → MIT License
```

---

## 🙌 Especial Reconocimiento

### A la Comunidad Open-Source
- Por proporcionar herramientas de calidad profesional
- Por la documentación exhaustiva y ejemplos
- Por el soporte activo en comunidades

### A los Estándares Web
- **W3C** - Web Standards
- **ECMA** - JavaScript Standards
- **IANA** - Internet Assigned Numbers Authority

### A las Plataformas
- **Supabase** - Por facilitar backend rápidamente
- **Vercel** - Por infraestructura moderna
- **GitHub** - Por almacenamiento y CI/CD

---

## 📞 Contacto y Soporte

Si tienes preguntas sobre las atribuciones o deseas:
- Reportar un problema de licencia
- Sugerir adiciones a los créditos
- Contactar sobre contribuciones

**Email:** info@sibagestion.cl  
**GitHub:** [@SibaGestion](https://github.com/SibaGestion)

---

<div align="center">

**Delivery Custom App** - Sistema integral de gestión  
Construido con ❤️ y tecnología open-source

*Last Updated: 2026-05-04*

</div>
