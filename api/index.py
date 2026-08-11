import sys
import os

# Agregamos la carpeta raíz al path para que pueda importar 'backend'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
