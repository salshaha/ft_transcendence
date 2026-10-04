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
├── Makefile
├── README.md
├── tasks
│   ├── app.py
│   └── template
│       └── tasks.html
└── update_info
    └── update_info.py
```