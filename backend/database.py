"""
Módulo de Gestión de Conexión a Base de Datos MySQL
"""

import mysql.connector
from mysql.connector import pooling
import datetime
from decimal import Decimal
from config import DB_CONFIG

# Pool de conexiones para alto rendimiento
try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="autorent_pool",
        pool_size=15,
        **DB_CONFIG
    )
except Exception as e:
    print(f"[WARN] No se pudo inicializar el pool, se usarán conexiones directas: {e}")
    connection_pool = None


def get_db_connection():
    """
    Retorna una conexión activa a MySQL Server en la máquina virtual VirtualBox.
    """
    if connection_pool:
        try:
            return connection_pool.get_connection()
        except Exception:
            # Fallback inmediato si el pool está agotado temporalmente
            return mysql.connector.connect(**DB_CONFIG)
    return mysql.connector.connect(**DB_CONFIG)


def serialize_item(item):
    """
    Serializa tipos complejos de MySQL (datetime, date, Decimal) a tipos JSON nativos.
    """
    if item is None:
        return None
    if isinstance(item, list):
        return [serialize_item(i) for i in item]
    if isinstance(item, dict):
        cleaned = {}
        for k, v in item.items():
            k_low = k.lower()
            # Manejar claves con caracteres especiales como 'año', 'ao', 'anio' evitando columnas estándar
            if k_low not in {"id_vehiculo", "id_marca", "id_tipo_vehiculo", "placa", "modelo", "color", "estado", "kilometraje", "marca_nombre", "tipo_nombre"} and ("a" in k_low and "o" in k_low and len(k_low) <= 4):
                val = serialize_item(v)
                cleaned["año"] = val
                cleaned["anio"] = val
            else:
                cleaned[k] = serialize_item(v)
        return cleaned
    if isinstance(item, (datetime.datetime, datetime.date)):

        return item.isoformat()
    if isinstance(item, Decimal):
        return float(item)
    return item
