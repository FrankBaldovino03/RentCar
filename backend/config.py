"""
Configuración de la Base de Datos y Servidor Flask
Conexión directa a la Máquina Virtual VirtualBox (Ubuntu MySQL Server)
"""

DB_CONFIG = {
    "host": "192.168.56.101",
    "port": 3306,
    "user": "frankbaldovino03",
    "password": "frankbaldovino03",
    "database": "alquiler_vehiculos",
    "charset": "utf8mb4",
    "use_unicode": True,
    "connection_timeout": 10
}

SERVER_PORT = 5000
SERVER_HOST = "0.0.0.0"
DEBUG_MODE = True
