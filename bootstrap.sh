#!/bin/bash

echo "🔧 Início da configuração do ambiente AGI..."

# Atualizar pacotes
apt update && apt upgrade -y

# Instalar dependências principais
apt install -y git curl wget unzip build-essential python3 python3-pip nodejs npm

# Instalar ferramentas úteis
apt install -y htop nano net-tools

# Instalar e ativar virtualenv
pip3 install virtualenv
virtualenv agi_env
source agi_env/bin/activate

# Instalar dependências Python comuns
pip install openai requests beautifulsoup4 pandas flask

# Criar pasta base
mkdir -p /opt/agi
echo "AGI environment is ready." > /opt/agi/ready.txt

# Mensagem final
echo "✅ Ambiente AGI instalado com sucesso!"
