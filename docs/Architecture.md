# Architecture

### Project Architecture

we will use monorepo architecture, meaning both backend and the frontend will be in the same repo but in separate folders.

**folder structure**
```
ft_transcendence
|
├── be
│   ├── app
│   │   ├── auth
│   │   ├── config.py
│   │   ├── __init__.py
│   │   ├── models
│   │   ├── routes
│   │   ├── services
│   │   └── utils
│   ├── migrations
│   ├── requirements.txt
│   ├── run.py
│   └── tests
├── db
│   └── README.md
├── docker-compose.yml
├── docs
│   ├── api-naming-rules.md
│   ├── Architecture.md
│   ├── database-migration.md
│   ├── git-rules.md
│   └── rules.md
├── fe
│   ├── package.json
│   ├── public
│   └── src
│       ├── assets
│       ├── components
│       ├── hooks
│       ├── layouts
│       ├── pages
│       └── services
├── waf
│   ├── modsecurity-override.conf.template
│   └── nginx
├── Makefile
├── README.md
├── tasks
│   ├── app.py
│   └── template
│       └── tasks.html
└── update_info
    └── update_info.py
```

### Request ingress

Browser traffic enters through the Nginx + ModSecurity + OWASP CRS service.
Nginx proxies `/api/` and `/auth/` to Flask, and all other application paths
to the Vite frontend. The frontend uses same-origin API URLs. The Flask,
frontend, and PostgreSQL services have no published host ports; PostgreSQL and
the application services communicate over the private Compose network.

See [waf.md](waf.md) for the pinned WAF image, configuration, audit logs, and
local/deployment commands.