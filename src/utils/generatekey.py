import secrets
import string

def generate_secure_key(length=32):
  alphabet = string.ascii_letters + string.digits
  key = ''.join(secrets.choice(alphabet) for i in range(length))
  return key

secure_key = generate_secure_key()
print(secure_key)



# ENCRYPTION_KEY=ap9qiZEylbDRfdKtJQk7LwWkZ3JLn7Hy INI DI ENVVVV