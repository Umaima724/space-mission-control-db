"""Authentication router: login, JWT generation, role-based access."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
import oracledb
from ..database import get_db_dependency
from ..models import Token, TokenData, UserRole, UserLogin
from ..config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Demo users (in production, use DB table USERS)
DEMO_USERS = {
    "admin": {"password": pwd_context.hash("admin123"), "role": UserRole.ADMIN},
    "operator": {"password": pwd_context.hash("operator123"), "role": UserRole.OPERATOR},
    "viewer": {"password": pwd_context.hash("viewer123"), "role": UserRole.VIEWER},
}

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

def authenticate_user(username: str, password: str):
    user = DEMO_USERS.get(username)
    if not user or not verify_password(password, user["password"]):
        return None
    return {"username": username, "role": user["role"]}

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=UserRole(role) if role else None)
    except JWTError:
        raise credentials_exception
    
    user = DEMO_USERS.get(username)
    if user is None:
        raise credentials_exception
    return {"username": username, "role": token_data.role}

def require_role(required_roles: list[UserRole]):
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in required_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    access_token = create_access_token(data={"sub": user["username"], "role": user["role"].value})
    return Token(access_token=access_token, role=user["role"], username=user["username"])

@router.get("/me")
async def read_current_user(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "role": current_user["role"].value}