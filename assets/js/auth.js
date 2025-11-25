(function (window) {
    'use strict';

    const AuthService = {
        // Salvar usuário
        saveUser(userData) {
            const users = this.getAllUsers();
            const existingUser = users.find(u => u.email === userData.email);
            
            if (existingUser && !userData.isLogin) {
                throw new Error('Este e-mail já está cadastrado.');
            }
            
            if (existingUser && userData.isLogin) {
                // Login: verificar senha
                if (existingUser.password !== userData.password) {
                    throw new Error('Senha incorreta.');
                }
                // Atualizar dados se necessário
                Object.assign(existingUser, {
                    name: userData.name || existingUser.name,
                    cellphone: userData.cellphone || existingUser.cellphone,
                    taxId: userData.taxId || existingUser.taxId,
                    lastLogin: new Date().toISOString()
                });
            } else if (!existingUser && !userData.isLogin) {
                // Novo cadastro
                const newUser = {
                    ...userData,
                    id: 'user_' + Date.now(),
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    sentToN8N: false // Flag para saber se já foi enviado para o n8n
                };
                users.push(newUser);
            }
            
            localStorage.setItem('natucart_users', JSON.stringify(users));
            const currentUser = existingUser || users[users.length - 1];
            localStorage.setItem('natucart_current_user', JSON.stringify(currentUser));
            return currentUser;
        },
        
        // Obter todos os usuários
        getAllUsers() {
            try {
                return JSON.parse(localStorage.getItem('natucart_users') || '[]');
            } catch {
                return [];
            }
        },
        
        // Obter usuário atual
        getCurrentUser() {
            try {
                return JSON.parse(localStorage.getItem('natucart_current_user') || 'null');
            } catch {
                return null;
            }
        },
        
        // Fazer logout
        logout() {
            localStorage.removeItem('natucart_current_user');
        },
        
        // Verificar se está logado
        isLoggedIn() {
            return this.getCurrentUser() !== null;
        },
        
        // Requer login (redireciona se não estiver logado)
        requireLogin(redirectTo = 'login.html') {
            if (!this.isLoggedIn()) {
                const currentPath = window.location.pathname;
                const redirect = currentPath !== '/index.html' && currentPath !== '/' 
                    ? `?redirect=${currentPath.replace('.html', '').replace('/', '')}` 
                    : '';
                window.location.href = redirectTo + redirect;
                return false;
            }
            return true;
        },
        
        // Verificar se usuário precisa ser enviado para o n8n
        needsN8NSync() {
            const user = this.getCurrentUser();
            return user && !user.sentToN8N;
        },
        
        // Marcar como enviado para o n8n
        markAsSentToN8N() {
            const user = this.getCurrentUser();
            if (user) {
                user.sentToN8N = true;
                const users = this.getAllUsers();
                const userIndex = users.findIndex(u => u.id === user.id);
                if (userIndex !== -1) {
                    users[userIndex].sentToN8N = true;
                    localStorage.setItem('natucart_users', JSON.stringify(users));
                    localStorage.setItem('natucart_current_user', JSON.stringify(user));
                }
            }
        }
    };

    window.AuthService = AuthService;
})(window);

