// ==================== SYSTÈME D'AUTHENTIFICATION ====================

class AuthManager {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = this.getCurrentUser();
        this.initDefaultUser();
    }

    initDefaultUser() {
        if (this.users.length === 0) {
            this.users.push({
                id: this.generateId(),
                username: 'admin',
                password: 'admin123', // En production, utilisez un hash
                nomComplet: 'Administrateur',
                role: 'admin',
                dateCreation: new Date().toISOString()
            });
            this.saveUsers();
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    loadUsers() {
        const data = localStorage.getItem('users_scg');
        return data ? JSON.parse(data) : [];
    }

    saveUsers() {
        localStorage.setItem('users_scg', JSON.stringify(this.users));
    }

    getCurrentUser() {
        const userData = sessionStorage.getItem('currentUser_scg');
        return userData ? JSON.parse(userData) : null;
    }

    login(username, password) {
        const user = this.users.find(u => u.username === username && u.password === password);
        if (user) {
            const userSession = {
                id: user.id,
                username: user.username,
                nomComplet: user.nomComplet,
                role: user.role
            };
            sessionStorage.setItem('currentUser_scg', JSON.stringify(userSession));
            this.currentUser = userSession;
            return true;
        }
        return false;
    }

    logout() {
        sessionStorage.removeItem('currentUser_scg');
        this.currentUser = null;
        window.location.reload();
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    addUser(userData) {
        // Vérifier si le username existe déjà
        if (this.users.find(u => u.username === userData.username)) {
            return { success: false, message: 'Ce nom d\'utilisateur existe déjà' };
        }

        const newUser = {
            id: this.generateId(),
            ...userData,
            dateCreation: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveUsers();
        return { success: true, user: newUser };
    }

    updateUser(id, updates) {
        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
            // Vérifier si le nouveau username n'existe pas déjà
            if (updates.username && updates.username !== this.users[index].username) {
                if (this.users.find(u => u.username === updates.username)) {
                    return { success: false, message: 'Ce nom d\'utilisateur existe déjà' };
                }
            }
            this.users[index] = { ...this.users[index], ...updates };
            this.saveUsers();
            return { success: true };
        }
        return { success: false, message: 'Utilisateur non trouvé' };
    }

    deleteUser(id) {
        // Ne pas supprimer l'utilisateur actuel
        if (this.currentUser && this.currentUser.id === id) {
            return { success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' };
        }

        this.users = this.users.filter(u => u.id !== id);
        this.saveUsers();
        return { success: true };
    }
}

// ==================== GESTION DE L'HISTORIQUE ====================

class HistoriqueManager {
    constructor() {
        this.historique = this.loadHistorique();
    }

    loadHistorique() {
        const data = localStorage.getItem('historique_scg');
        return data ? JSON.parse(data) : [];
    }

    saveHistorique() {
        localStorage.setItem('historique_scg', JSON.stringify(this.historique));
    }

    addEntry(action, details, user) {
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            date: new Date().toISOString(),
            action,
            details,
            utilisateur: user
        };

        this.historique.unshift(entry);
        
        // Garder seulement les 1000 dernières entrées
        if (this.historique.length > 1000) {
            this.historique = this.historique.slice(0, 1000);
        }

        this.saveHistorique();
    }

    getFiltered(typeAction, date) {
        return this.historique.filter(entry => {
            const matchType = !typeAction || entry.action === typeAction;
            const matchDate = !date || entry.date.startsWith(date);
            return matchType && matchDate;
        });
    }
}

// ==================== GESTION DES SORTIES ====================

class SortieManager {
    constructor() {
        this.sorties = this.loadSorties();
    }

    loadSorties() {
        const data = localStorage.getItem('sorties_scg');
        return data ? JSON.parse(data) : [];
    }

    saveSorties() {
        localStorage.setItem('sorties_scg', JSON.stringify(this.sorties));
    }

    addSortie(sortie, user) {
        const newSortie = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            ...sortie,
            date: new Date().toISOString(),
            utilisateur: user
        };

        this.sorties.unshift(newSortie);
        this.saveSorties();
        return newSortie;
    }

    deleteSortie(id) {
        this.sorties = this.sorties.filter(s => s.id !== id);
        this.saveSorties();
    }

    getFiltered(dateDebut, dateFin) {
        return this.sorties.filter(sortie => {
            const sortieDate = new Date(sortie.date);
            const matchDebut = !dateDebut || sortieDate >= new Date(dateDebut);
            const matchFin = !dateFin || sortieDate <= new Date(dateFin + 'T23:59:59');
            return matchDebut && matchFin;
        });
    }

    getMonthlySorties() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return this.sorties.filter(s => new Date(s.date) >= firstDay).length;
    }
}

// ==================== GESTION DES MÉDICAMENTS ====================

class MedicamentManager {
    constructor() {
        this.medicaments = this.loadFromStorage();
        this.currentEditId = null;
        this.authManager = new AuthManager();
        this.historiqueManager = new HistoriqueManager();
        this.sortieManager = new SortieManager();
        
        this.checkAuth();
    }

    checkAuth() {
        if (!this.authManager.isLoggedIn()) {
            document.getElementById('loginPage').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
        } else {
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            document.getElementById('currentUser').textContent = this.authManager.currentUser.nomComplet;
            this.init();
        }
    }

    init() {
        this.renderTable();
        this.updateStats();
        this.renderSortiesTable();
        this.renderHistoriqueTable();
        this.renderUsersTable();
        this.updateSortieMedicamentSelect();
        this.attachEventListeners();
    }

    loadFromStorage() {
        const data = localStorage.getItem('medicaments_scg');
        return data ? JSON.parse(data) : [];
    }

    saveToStorage() {
        localStorage.setItem('medicaments_scg', JSON.stringify(this.medicaments));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    addMedicament(medicament) {
        const newMed = {
            id: this.generateId(),
            ...medicament,
            dateAjout: new Date().toISOString()
        };
        this.medicaments.push(newMed);
        this.saveToStorage();
        this.renderTable();
        this.updateStats();
        this.updateSortieMedicamentSelect();
        
        this.historiqueManager.addEntry(
            'ajout',
            `Ajout du médicament: ${newMed.nom} (${newMed.quantite} ${newMed.unite})`,
            this.authManager.currentUser.nomComplet
        );
        
        return newMed;
    }

    updateMedicament(id, updates) {
        const index = this.medicaments.findIndex(m => m.id === id);
        if (index !== -1) {
            const oldMed = { ...this.medicaments[index] };
            this.medicaments[index] = { ...this.medicaments[index], ...updates };
            this.saveToStorage();
            this.renderTable();
            this.updateStats();
            this.updateSortieMedicamentSelect();
            
            this.historiqueManager.addEntry(
                'modification',
                `Modification du médicament: ${updates.nom || oldMed.nom}`,
                this.authManager.currentUser.nomComplet
            );
        }
    }

    deleteMedicament(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce médicament ?')) {
            const med = this.medicaments.find(m => m.id === id);
            this.medicaments = this.medicaments.filter(m => m.id !== id);
            this.saveToStorage();
            this.renderTable();
            this.updateStats();
            this.updateSortieMedicamentSelect();
            
            if (med) {
                this.historiqueManager.addEntry(
                    'suppression',
                    `Suppression du médicament: ${med.nom}`,
                    this.authManager.currentUser.nomComplet
                );
            }
        }
    }

    adjustQuantity(id) {
        const med = this.medicaments.find(m => m.id === id);
        if (!med) return;

        const adjustment = prompt(`Quantité actuelle: ${med.quantite} ${med.unite}\n\nEntrez l'ajustement (+ ou -):\nExemple: +5 ou -3`);
        
        if (adjustment) {
            const value = parseInt(adjustment);
            if (!isNaN(value)) {
                const oldQty = med.quantite;
                const newQuantity = Math.max(0, med.quantite + value);
                this.updateMedicament(id, { quantite: newQuantity });
                
                this.historiqueManager.addEntry(
                    'modification',
                    `Ajustement de quantité: ${med.nom} (${oldQty} → ${newQuantity} ${med.unite})`,
                    this.authManager.currentUser.nomComplet
                );
            }
        }
    }

    getStatus(med) {
        const today = new Date();
        const expDate = med.dateExpiration ? new Date(med.dateExpiration) : null;
        
        if (expDate) {
            const daysUntilExpiry = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) {
                return { text: 'Périmé', class: 'badge-danger' };
            } else if (daysUntilExpiry <= 30) {
                return { text: 'Expire bientôt', class: 'badge-warning' };
            }
        }
        
        if (med.quantite <= med.seuilMin) {
            return { text: 'Stock faible', class: 'badge-warning' };
        }
        
        return { text: 'Disponible', class: 'badge-success' };
    }

    filterMedicaments(searchTerm, categorie, stockFilter) {
        return this.medicaments.filter(med => {
            const matchSearch = med.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (med.emplacement && med.emplacement.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchCategorie = !categorie || med.categorie === categorie;
            
            let matchStock = true;
            if (stockFilter === 'low') {
                matchStock = med.quantite <= med.seuilMin;
            } else if (stockFilter === 'expired') {
                const expDate = med.dateExpiration ? new Date(med.dateExpiration) : null;
                if (expDate) {
                    const daysUntilExpiry = Math.floor((expDate - new Date()) / (1000 * 60 * 60 * 24));
                    matchStock = daysUntilExpiry <= 30;
                } else {
                    matchStock = false;
                }
            }
            
            return matchSearch && matchCategorie && matchStock;
        });
    }

    renderTable(filtered = null) {
        const tbody = document.getElementById('tableBody');
        const meds = filtered || this.medicaments;
        
        if (meds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">Aucun médicament trouvé</td></tr>';
            return;
        }

        tbody.innerHTML = meds.map(med => {
            const status = this.getStatus(med);
            const expDate = med.dateExpiration ? new Date(med.dateExpiration).toLocaleDateString('fr-FR') : '-';
            
            return `
                <tr>
                    <td><strong>${med.nom}</strong></td>
                    <td>${med.categorie}</td>
                    <td>${med.quantite} ${med.unite}</td>
                    <td>${med.emplacement || '-'}</td>
                    <td>${expDate}</td>
                    <td><span class="badge ${status.class}">${status.text}</span></td>
                    <td>
                        <button class="action-btn btn-adjust" onclick="manager.adjustQuantity('${med.id}')">±</button>
                        <button class="action-btn btn-edit" onclick="manager.editMedicament('${med.id}')">✏️</button>
                        <button class="action-btn btn-delete" onclick="manager.deleteMedicament('${med.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateStats() {
        const total = this.medicaments.length;
        const lowStock = this.medicaments.filter(m => m.quantite <= m.seuilMin).length;
        
        let expiredSoon = 0;
        const today = new Date();
        this.medicaments.forEach(med => {
            if (med.dateExpiration) {
                const expDate = new Date(med.dateExpiration);
                const daysUntilExpiry = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry <= 30) {
                    expiredSoon++;
                }
            }
        });

        const monthlyExits = this.sortieManager.getMonthlySorties();

        document.getElementById('totalMeds').textContent = total;
        document.getElementById('lowStock').textContent = lowStock;
        document.getElementById('expiredSoon').textContent = expiredSoon;
        document.getElementById('monthlyExits').textContent = monthlyExits;
    }

    editMedicament(id) {
        const med = this.medicaments.find(m => m.id === id);
        if (!med) return;

        this.currentEditId = id;
        
        document.getElementById('nom').value = med.nom;
        document.getElementById('categorie').value = med.categorie;
        document.getElementById('quantite').value = med.quantite;
        document.getElementById('unite').value = med.unite;
        document.getElementById('seuilMin').value = med.seuilMin;
        document.getElementById('dateExpiration').value = med.dateExpiration || '';
        document.getElementById('emplacement').value = med.emplacement || '';
        document.getElementById('numeroLot').value = med.numeroLot || '';
        
        document.getElementById('btnText').textContent = 'Modifier';
        
        // Scroll vers le formulaire et activer l'onglet stock
        document.querySelector('[data-tab="stock"]').click();
        document.getElementById('medicamentForm').scrollIntoView({ behavior: 'smooth' });
    }

    resetForm() {
        document.getElementById('medicamentForm').reset();
        this.currentEditId = null;
        document.getElementById('btnText').textContent = 'Ajouter';
    }

    // ==================== GESTION DES SORTIES ====================

    updateSortieMedicamentSelect() {
        const select = document.getElementById('sortieMedicament');
        select.innerHTML = '<option value="">Sélectionner un médicament</option>';
        
        this.medicaments
            .filter(m => m.quantite > 0)
            .forEach(med => {
                select.innerHTML += `<option value="${med.id}">${med.nom} (Stock: ${med.quantite} ${med.unite})</option>`;
            });
    }

    handleSortie(sortieData) {
        const med = this.medicaments.find(m => m.id === sortieData.medicamentId);
        if (!med) {
            alert('Médicament non trouvé');
            return;
        }

        if (med.quantite < sortieData.quantite) {
            alert('Stock insuffisant');
            return;
        }

        // Enregistrer la sortie
        const sortie = this.sortieManager.addSortie({
            medicamentId: med.id,
            medicamentNom: med.nom,
            quantite: sortieData.quantite,
            unite: med.unite,
            destination: sortieData.destination,
            motif: sortieData.motif,
            observations: sortieData.observations
        }, this.authManager.currentUser.nomComplet);

        // Mettre à jour le stock
        this.updateMedicament(med.id, { quantite: med.quantite - sortieData.quantite });

        // Ajouter à l'historique
        this.historiqueManager.addEntry(
            'sortie',
            `Sortie: ${med.nom} (${sortieData.quantite} ${med.unite}) - ${sortieData.destination}`,
            this.authManager.currentUser.nomComplet
        );

        this.renderSortiesTable();
        this.resetSortieForm();
    }

    renderSortiesTable(filtered = null) {
        const tbody = document.getElementById('sortiesTableBody');
        const sorties = filtered || this.sortieManager.sorties;
        
        if (sorties.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">Aucune sortie enregistrée</td></tr>';
            return;
        }

        tbody.innerHTML = sorties.map(sortie => {
            const date = new Date(sortie.date).toLocaleString('fr-FR');
            return `
                <tr>
                    <td>${date}</td>
                    <td><strong>${sortie.medicamentNom}</strong></td>
                    <td>${sortie.quantite} ${sortie.unite}</td>
                    <td>${sortie.destination}</td>
                    <td>${sortie.motif}</td>
                    <td>${sortie.utilisateur}</td>
                    <td>
                        <button class="action-btn btn-view" onclick="manager.viewSortieDetails('${sortie.id}')">👁️</button>
                        ${this.authManager.currentUser.role === 'admin' ? 
                            `<button class="action-btn btn-delete" onclick="manager.deleteSortie('${sortie.id}')">🗑️</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    viewSortieDetails(id) {
        const sortie = this.sortieManager.sorties.find(s => s.id === id);
        if (!sortie) return;

        const date = new Date(sortie.date).toLocaleString('fr-FR');
        alert(`
DÉTAILS DE LA SORTIE

Date: ${date}
Médicament: ${sortie.medicamentNom}
Quantité: ${sortie.quantite} ${sortie.unite}
Destination: ${sortie.destination}
Motif: ${sortie.motif}
Observations: ${sortie.observations || 'Aucune'}
Utilisateur: ${sortie.utilisateur}
        `);
    }

    deleteSortie(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette sortie ?')) {
            const sortie = this.sortieManager.sorties.find(s => s.id === id);
            
            // Optionnel: Restaurer le stock
            const restore = confirm('Voulez-vous restaurer le stock ?');
            if (restore && sortie) {
                const med = this.medicaments.find(m => m.id === sortie.medicamentId);
                if (med) {
                    this.updateMedicament(med.id, { quantite: med.quantite + sortie.quantite });
                }
            }

            this.sortieManager.deleteSortie(id);
            
            if (sortie) {
                this.historiqueManager.addEntry(
                    'suppression',
                    `Suppression de sortie: ${sortie.medicamentNom} (${sortie.quantite} ${sortie.unite})`,
                    this.authManager.currentUser.nomComplet
                );
            }

            this.renderSortiesTable();
            this.updateStats();
        }
    }

    resetSortieForm() {
        document.getElementById('sortieForm').reset();
        document.getElementById('stockDisponible').textContent = '';
    }

    // ==================== GESTION DE L'HISTORIQUE ====================

    renderHistoriqueTable(filtered = null) {
        const tbody = document.getElementById('historiqueTableBody');
        const entries = filtered || this.historiqueManager.historique;
        
        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px;">Aucune activité enregistrée</td></tr>';
            return;
        }

        tbody.innerHTML = entries.slice(0, 100).map(entry => {
            const date = new Date(entry.date).toLocaleString('fr-FR');
            let badgeClass = 'badge-success';
            if (entry.action === 'suppression') badgeClass = 'badge-danger';
            if (entry.action === 'modification') badgeClass = 'badge-warning';
            
            return `
                <tr>
                    <td>${date}</td>
                    <td><span class="badge ${badgeClass}">${entry.action.toUpperCase()}</span></td>
                    <td>${entry.details}</td>
                    <td>${entry.utilisateur}</td>
                </tr>
            `;
        }).join('');
    }

    // ==================== GESTION DES UTILISATEURS ====================

    renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        const users = this.authManager.users;
        
        tbody.innerHTML = users.map(user => {
            const date = new Date(user.dateCreation).toLocaleDateString('fr-FR');
            const isCurrentUser = this.authManager.currentUser.id === user.id;
            
            return `
                <tr>
                    <td><strong>${user.username}</strong> ${isCurrentUser ? '(Vous)' : ''}</td>
                    <td>${user.nomComplet}</td>
                    <td><span class="badge ${user.role === 'admin' ? 'badge-danger' : 'badge-success'}">${user.role.toUpperCase()}</span></td>
                    <td>${date}</td>
                    <td>
                        ${this.authManager.currentUser.role === 'admin' && !isCurrentUser ? 
                            `<button class="action-btn btn-edit" onclick="manager.editUser('${user.id}')">✏️</button>
                             <button class="action-btn btn-delete" onclick="manager.deleteUser('${user.id}')">🗑️</button>` : 
                            '-'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    addUser(userData) {
        const result = this.authManager.addUser(userData);
        
        if (result.success) {
            this.renderUsersTable();
            this.resetUserForm();
            
            this.historiqueManager.addEntry(
                'ajout',
                `Nouvel utilisateur créé: ${userData.username} (${userData.nomComplet})`,
                this.authManager.currentUser.nomComplet
            );
            
            alert('Utilisateur ajouté avec succès');
        } else {
            alert(result.message);
        }
    }

    editUser(id) {
        const user = this.authManager.users.find(u => u.id === id);
        if (!user) return;

        document.getElementById('newUsername').value = user.username;
        document.getElementById('newPassword').value = user.password;
        document.getElementById('newNomComplet').value = user.nomComplet;
        document.getElementById('newRole').value = user.role;
        
        document.getElementById('btnUserText').textContent = 'Modifier l\'utilisateur';
        
        // Stocker l'ID pour la modification
        document.getElementById('userForm').dataset.editId = id;
    }

    deleteUser(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
            const user = this.authManager.users.find(u => u.id === id);
            const result = this.authManager.deleteUser(id);
            
            if (result.success) {
                this.renderUsersTable();
                
                if (user) {
                    this.historiqueManager.addEntry(
                        'suppression',
                        `Utilisateur supprimé: ${user.username}`,
                        this.authManager.currentUser.nomComplet
                    );
                }
                
                alert('Utilisateur supprimé');
            } else {
                alert(result.message);
            }
        }
    }

    resetUserForm() {
        document.getElementById('userForm').reset();
        document.getElementById('btnUserText').textContent = 'Ajouter l\'utilisateur';
        delete document.getElementById('userForm').dataset.editId;
    }

    // ==================== EXPORTS ====================

    exportToCSV() {
        const headers = ['Nom', 'Catégorie', 'Quantité', 'Unité', 'Seuil Min', 'Date Expiration', 'Emplacement', 'N° Lot'];
        const rows = this.medicaments.map(m => [
            m.nom,
            m.categorie,
            m.quantite,
            m.unite,
            m.seuilMin,
            m.dateExpiration || '',
            m.emplacement || '',
            m.numeroLot || ''
        ]);

        this.downloadCSV(headers, rows, 'stock_medicaments');
    }

    exportSortiesToCSV() {
        const headers = ['Date', 'Médicament', 'Quantité', 'Unité', 'Destination', 'Motif', 'Observations', 'Utilisateur'];
        const rows = this.sortieManager.sorties.map(s => [
            new Date(s.date).toLocaleString('fr-FR'),
            s.medicamentNom,
            s.quantite,
            s.unite,
            s.destination,
            s.motif,
            s.observations || '',
            s.utilisateur
        ]);

        this.downloadCSV(headers, rows, 'sorties_stock');
    }

    exportHistoriqueToCSV() {
        const headers = ['Date', 'Action', 'Détails', 'Utilisateur'];
        const rows = this.historiqueManager.historique.map(h => [
            new Date(h.date).toLocaleString('fr-FR'),
            h.action,
            h.details,
            h.utilisateur
        ]);

        this.downloadCSV(headers, rows, 'historique');
    }

    downloadCSV(headers, rows, filename) {
        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // ==================== ÉVÉNEMENTS ====================

    attachEventListeners() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (this.authManager.login(username, password)) {
                this.checkAuth();
            } else {
                const errorDiv = document.getElementById('loginError');
                errorDiv.textContent = 'Nom d\'utilisateur ou mot de passe incorrect';
                errorDiv.classList.add('show');
                
                setTimeout(() => {
                    errorDiv.classList.remove('show');
                }, 3000);
            }
        });

        // Logout
        document.getElementById('btnLogout').addEventListener('click', () => {
            this.authManager.logout();
        });

        // Onglets
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
            });
        });

        // Formulaire médicament
        document.getElementById('medicamentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                nom: document.getElementById('nom').value,
                categorie: document.getElementById('categorie').value,
                quantite: parseInt(document.getElementById('quantite').value),
                unite: document.getElementById('unite').value,
                seuilMin: parseInt(document.getElementById('seuilMin').value) || 10,
                dateExpiration: document.getElementById('dateExpiration').value,
                emplacement: document.getElementById('emplacement').value,
                numeroLot: document.getElementById('numeroLot').value
            };

            if (this.currentEditId) {
                this.updateMedicament(this.currentEditId, formData);
            } else {
                this.addMedicament(formData);
            }

            this.resetForm();
        });

        document.getElementById('btnCancel').addEventListener('click', () => {
            this.resetForm();
        });

        // Recherche et filtres stock
        document.getElementById('searchInput').addEventListener('input', () => {
            this.applyFilters();
        });

        document.getElementById('filterCategorie').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('filterStock').addEventListener('change', () => {
            this.applyFilters();
        });

        // Export stock
        document.getElementById('btnExport').addEventListener('click', () => {
            this.exportToCSV();
        });

        // Formulaire sortie
        document.getElementById('sortieMedicament').addEventListener('change', (e) => {
            const medId = e.target.value;
            if (medId) {
                const med = this.medicaments.find(m => m.id === medId);
                if (med) {
                    document.getElementById('stockDisponible').textContent = 
                        `Stock disponible: ${med.quantite} ${med.unite}`;
                }
            } else {
                document.getElementById('stockDisponible').textContent = '';
            }
        });

        document.getElementById('sortieForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const sortieData = {
                medicamentId: document.getElementById('sortieMedicament').value,
                quantite: parseInt(document.getElementById('sortieQuantite').value),
                destination: document.getElementById('sortieDestination').value,
                motif: document.getElementById('sortieMotif').value,
                observations: document.getElementById('sortieObservations').value
            };

            this.handleSortie(sortieData);
        });

        document.getElementById('btnCancelSortie').addEventListener('click', () => {
            this.resetSortieForm();
        });

        // Filtres sorties
        document.getElementById('btnFilterSorties').addEventListener('click', () => {
            const dateDebut = document.getElementById('filterDateDebut').value;
            const dateFin = document.getElementById('filterDateFin').value;
            const filtered = this.sortieManager.getFiltered(dateDebut, dateFin);
            this.renderSortiesTable(filtered);
        });

        // Export sorties
        document.getElementById('btnExportSorties').addEventListener('click', () => {
            this.exportSortiesToCSV();
        });

        // Filtres historique
        document.getElementById('btnFilterHistorique').addEventListener('click', () => {
            const typeAction = document.getElementById('filterTypeAction').value;
            const date = document.getElementById('filterHistoriqueDate').value;
            const filtered = this.historiqueManager.getFiltered(typeAction, date);
            this.renderHistoriqueTable(filtered);
        });

        // Export historique
        document.getElementById('btnExportHistorique').addEventListener('click', () => {
            this.exportHistoriqueToCSV();
        });

        // Formulaire utilisateur
        document.getElementById('userForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const userData = {
                username: document.getElementById('newUsername').value,
                password: document.getElementById('newPassword').value,
                nomComplet: document.getElementById('newNomComplet').value,
                role: document.getElementById('newRole').value
            };

            const editId = e.target.dataset.editId;
            
            if (editId) {
                const result = this.authManager.updateUser(editId, userData);
                if (result.success) {
                    this.renderUsersTable();
                    this.resetUserForm();
                    alert('Utilisateur modifié avec succès');
                } else {
                    alert(result.message);
                }
            } else {
                this.addUser(userData);
            }
        });

        document.getElementById('btnCancelUser').addEventListener('click', () => {
            this.resetUserForm();
        });
    }

    applyFilters() {
        const search = document.getElementById('searchInput').value;
        const categorie = document.getElementById('filterCategorie').value;
        const stock = document.getElementById('filterStock').value;
        
        const filtered = this.filterMedicaments(search, categorie, stock);
        this.renderTable(filtered);
    }
}

// Initialisation
const manager = new MedicamentManager();