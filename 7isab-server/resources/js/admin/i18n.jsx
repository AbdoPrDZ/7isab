import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STRINGS = {
    en: {
        appName: '7isab',
        admin: 'Admin panel',
        signIn: 'Sign in',
        signInHint: 'Admins only. User data is end-to-end encrypted and never visible here.',
        email: 'Email',
        password: 'Password',
        invalid: 'Wrong email or password.',
        disabled: 'This account is disabled.',
        network: 'Cannot reach the server.',
        error: 'Something went wrong.',
        dashboard: 'Dashboard',
        users: 'Users',
        admins: 'Admins',
        signOut: 'Sign out',
        totalUsers: 'Users',
        activeUsers: 'Active',
        disabledUsers: 'Disabled',
        newUsers: 'New (30 days)',
        syncedUsers: 'Synced (7 days)',
        records: 'Encrypted records',
        storage: 'Storage used',
        adminCount: 'Admins',
        privacy: 'The server stores encrypted records only. Nobody here can read a user’s data.',
        search: 'Search by email or name',
        name: 'Name',
        status: 'Status',
        active: 'Active',
        inactive: 'Disabled',
        joined: 'Joined',
        lastSync: 'Last sync',
        lastLogin: 'Last login',
        devices: 'Devices',
        never: 'Never',
        actions: 'Actions',
        disable: 'Disable',
        enable: 'Enable',
        forceSignOut: 'Sign out everywhere',
        delete: 'Delete',
        confirmDelete: 'Delete this account and all its encrypted data? This cannot be undone.',
        confirmDisable: 'Disable this account and sign it out everywhere?',
        done: 'Done.',
        back: 'Back',
        noResults: 'Nothing found.',
        previous: 'Previous',
        next: 'Next',
        pageOf: 'Page {page} of {pages}',
        role: 'Role',
        roles: { 'super-admin': 'Super admin', admin: 'Admin' },
        addAdmin: 'Add an admin',
        editAdmin: 'Edit admin',
        save: 'Save',
        cancel: 'Cancel',
        newPassword: 'New password (optional)',
        you: 'You',
        theme: 'Theme',
        language: 'Language',
        community: {
            members: 'Community members',
            rules: 'Community rules',
            rulesHint: 'Each rule is shown on its own screen when joining and must be accepted separately. Tick "changed in substance" when the meaning changes: every member then accepts it again. Wording fixes keep the version.',
            addRule: 'Add a rule',
            editRule: 'Edit rule',
            edit: 'Edit',
            key: 'Key (lowercase letters, digits, _)',
            text_ar: 'Arabic text',
            text_en: 'English text',
            text_fr: 'French text',
            order: 'Order',
            orderN: 'Order {order}',
            versionN: 'Version {version}',
            changedInSubstance: 'Changed in substance: every member must accept this rule again.',
            confirmDeleteRule: 'Delete this rule? Members are not asked to accept anything.',
            searchMembers: 'Search by name',
            gender: 'Gender',
            genders: { male: 'Brother', female: 'Sister' },
            allGenders: 'All genders',
            statuses: { active: 'Active', left: 'Left', suspended: 'Suspended', banned: 'Banned' },
            allStatuses: 'All statuses',
            suspend: 'Suspend',
            ban: 'Ban',
            reactivate: 'Reactivate',
            changeGender: 'Change gender',
            confirmSuspend: 'Suspend this member? They can no longer take part until reactivated.',
            confirmBan: 'Ban this member? They cannot take part or rejoin until reactivated.',
            confirmGender: 'Change this member\u2019s gender to {gender}? Everything they see follows their gender.',
        },
    },
    ar: {
        appName: 'حساب',
        admin: 'لوحة الإدارة',
        signIn: 'تسجيل الدخول',
        signInHint: 'للمشرفين فقط. بيانات المستخدمين مشفّرة من طرف إلى طرف ولا تظهر هنا أبدًا.',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        invalid: 'البريد أو كلمة المرور غير صحيحة.',
        disabled: 'هذا الحساب معطّل.',
        network: 'تعذّر الاتصال بالخادم.',
        error: 'حدث خطأ ما.',
        dashboard: 'الرئيسية',
        users: 'المستخدمون',
        admins: 'المشرفون',
        signOut: 'تسجيل الخروج',
        totalUsers: 'المستخدمون',
        activeUsers: 'نشط',
        disabledUsers: 'معطّل',
        newUsers: 'جدد (30 يومًا)',
        syncedUsers: 'زامنوا (7 أيام)',
        records: 'سجلات مشفّرة',
        storage: 'المساحة المستعملة',
        adminCount: 'المشرفون',
        privacy: 'يخزّن الخادم سجلات مشفّرة فقط. لا أحد هنا يستطيع قراءة بيانات المستخدم.',
        search: 'ابحث بالبريد أو الاسم',
        name: 'الاسم',
        status: 'الحالة',
        active: 'نشط',
        inactive: 'معطّل',
        joined: 'التسجيل',
        lastSync: 'آخر مزامنة',
        lastLogin: 'آخر دخول',
        devices: 'الأجهزة',
        never: 'أبدًا',
        actions: 'إجراءات',
        disable: 'تعطيل',
        enable: 'تفعيل',
        forceSignOut: 'تسجيل الخروج من كل الأجهزة',
        delete: 'حذف',
        confirmDelete: 'حذف هذا الحساب وكل بياناته المشفّرة؟ لا يمكن التراجع.',
        confirmDisable: 'تعطيل هذا الحساب وتسجيل خروجه من كل الأجهزة؟',
        done: 'تم.',
        back: 'رجوع',
        noResults: 'لا توجد نتائج.',
        previous: 'السابق',
        next: 'التالي',
        pageOf: 'الصفحة {page} من {pages}',
        role: 'الدور',
        roles: { 'super-admin': 'مشرف عام', admin: 'مشرف' },
        addAdmin: 'إضافة مشرف',
        editAdmin: 'تعديل المشرف',
        save: 'حفظ',
        cancel: 'إلغاء',
        newPassword: 'كلمة مرور جديدة (اختياري)',
        you: 'أنت',
        theme: 'المظهر',
        language: 'اللغة',
        community: {
            members: 'أعضاء المجتمع',
            rules: 'قواعد المجتمع',
            rulesHint: 'تُعرض كل قاعدة في شاشة مستقلة عند الانضمام ويجب قبولها وحدها. فعّل خيار "تغيّر في المعنى" إذا تغيّر مضمونها، فيقبلها كل الأعضاء من جديد. تصحيح الصياغة يُبقي الإصدار نفسه.',
            addRule: 'إضافة قاعدة',
            editRule: 'تعديل القاعدة',
            edit: 'تعديل',
            key: 'المفتاح (حروف لاتينية صغيرة وأرقام و _)',
            text_ar: 'النص العربي',
            text_en: 'النص الإنجليزي',
            text_fr: 'النص الفرنسي',
            order: 'الترتيب',
            orderN: 'الترتيب {order}',
            versionN: 'الإصدار {version}',
            changedInSubstance: 'تغيّر في المعنى: يجب على كل الأعضاء قبول هذه القاعدة من جديد.',
            confirmDeleteRule: 'حذف هذه القاعدة؟ لن يُطلب من الأعضاء قبول أي شيء.',
            searchMembers: 'البحث بالاسم',
            gender: 'الجنس',
            genders: { male: 'أخ', female: 'أخت' },
            allGenders: 'الكل',
            statuses: { active: 'نشط', left: 'غادر', suspended: 'موقوف', banned: 'محظور' },
            allStatuses: 'كل الحالات',
            suspend: 'إيقاف',
            ban: 'حظر',
            reactivate: 'إعادة التفعيل',
            changeGender: 'تغيير الجنس',
            confirmSuspend: 'إيقاف هذا العضو؟ لن يستطيع المشاركة حتى تُعاد تفعيله.',
            confirmBan: 'حظر هذا العضو؟ لن يستطيع المشاركة ولا الانضمام من جديد حتى يُعاد تفعيله.',
            confirmGender: 'تغيير جنس هذا العضو إلى {gender}؟ كل ما يراه يتبع جنسه.',
        },
    },
    fr: {
        appName: '7isab',
        admin: 'Administration',
        signIn: 'Se connecter',
        signInHint: 'Réservé aux administrateurs. Les données des utilisateurs sont chiffrées de bout en bout et jamais visibles ici.',
        email: 'E-mail',
        password: 'Mot de passe',
        invalid: 'E-mail ou mot de passe incorrect.',
        disabled: 'Ce compte est désactivé.',
        network: 'Impossible de joindre le serveur.',
        error: 'Une erreur est survenue.',
        dashboard: 'Tableau de bord',
        users: 'Utilisateurs',
        admins: 'Administrateurs',
        signOut: 'Se déconnecter',
        totalUsers: 'Utilisateurs',
        activeUsers: 'Actifs',
        disabledUsers: 'Désactivés',
        newUsers: 'Nouveaux (30 j)',
        syncedUsers: 'Synchronisés (7 j)',
        records: 'Enregistrements chiffrés',
        storage: 'Stockage utilisé',
        adminCount: 'Administrateurs',
        privacy: 'Le serveur ne stocke que des enregistrements chiffrés. Personne ici ne peut lire les données d’un utilisateur.',
        search: 'Rechercher par e-mail ou nom',
        name: 'Nom',
        status: 'Statut',
        active: 'Actif',
        inactive: 'Désactivé',
        joined: 'Inscription',
        lastSync: 'Dernière synchro',
        lastLogin: 'Dernière connexion',
        devices: 'Appareils',
        never: 'Jamais',
        actions: 'Actions',
        disable: 'Désactiver',
        enable: 'Activer',
        forceSignOut: 'Déconnecter partout',
        delete: 'Supprimer',
        confirmDelete: 'Supprimer ce compte et toutes ses données chiffrées ? Action définitive.',
        confirmDisable: 'Désactiver ce compte et le déconnecter partout ?',
        done: 'Fait.',
        back: 'Retour',
        noResults: 'Aucun résultat.',
        previous: 'Précédent',
        next: 'Suivant',
        pageOf: 'Page {page} sur {pages}',
        role: 'Rôle',
        roles: { 'super-admin': 'Super administrateur', admin: 'Administrateur' },
        addAdmin: 'Ajouter un administrateur',
        editAdmin: 'Modifier l’administrateur',
        save: 'Enregistrer',
        cancel: 'Annuler',
        newPassword: 'Nouveau mot de passe (facultatif)',
        you: 'Vous',
        theme: 'Thème',
        language: 'Langue',
        community: {
            members: 'Membres de la communauté',
            rules: 'Règles de la communauté',
            rulesHint: 'Chaque règle est affichée sur son propre écran à l\u2019adhésion et doit être acceptée séparément. Cochez « changement de fond » si le sens change : chaque membre l\u2019accepte alors de nouveau. Une correction de forme garde la version.',
            addRule: 'Ajouter une règle',
            editRule: 'Modifier la règle',
            edit: 'Modifier',
            key: 'Clé (minuscules, chiffres, _)',
            text_ar: 'Texte arabe',
            text_en: 'Texte anglais',
            text_fr: 'Texte français',
            order: 'Ordre',
            orderN: 'Ordre {order}',
            versionN: 'Version {version}',
            changedInSubstance: 'Changement de fond : chaque membre doit accepter de nouveau cette règle.',
            confirmDeleteRule: 'Supprimer cette règle ? Rien n\u2019est demandé aux membres.',
            searchMembers: 'Rechercher par nom',
            gender: 'Genre',
            genders: { male: 'Frère', female: 'Sœur' },
            allGenders: 'Tous les genres',
            statuses: { active: 'Actif', left: 'Parti', suspended: 'Suspendu', banned: 'Banni' },
            allStatuses: 'Tous les statuts',
            suspend: 'Suspendre',
            ban: 'Bannir',
            reactivate: 'Réactiver',
            changeGender: 'Changer le genre',
            confirmSuspend: 'Suspendre ce membre ? Il ne peut plus participer jusqu\u2019à sa réactivation.',
            confirmBan: 'Bannir ce membre ? Il ne peut ni participer ni revenir jusqu\u2019à sa réactivation.',
            confirmGender: 'Changer le genre de ce membre en {gender} ? Tout ce qu\u2019il voit dépend de son genre.',
        },
    },
};

export const LANGUAGES = [
    { code: 'ar', label: 'العربية' },
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
];

const LANG_KEY = 'hisab.admin.lang';
const I18nContext = createContext(null);

function initialLanguage() {
    try {
        const stored = localStorage.getItem(LANG_KEY);
        if (stored && STRINGS[stored]) return stored;
    } catch {
        // Storage blocked.
    }
    const browser = (navigator.language || 'en').slice(0, 2);
    return STRINGS[browser] ? browser : 'en';
}

export function I18nProvider({ children }) {
    const [lang, setLang] = useState(initialLanguage);

    useEffect(() => {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        try {
            localStorage.setItem(LANG_KEY, lang);
        } catch {
            // Storage blocked.
        }
    }, [lang]);

    const value = useMemo(() => {
        const t = (key, params = {}) => {
            const text = key.split('.').reduce((node, part) => node?.[part], STRINGS[lang]) ?? key;
            return String(text).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
        };
        const number = (value) => new Intl.NumberFormat(`${lang}-u-nu-latn`).format(value ?? 0);
        const date = (iso) =>
            iso ? new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : t('never');
        const bytes = (value) => {
            const units = ['B', 'KB', 'MB', 'GB'];
            let size = value ?? 0;
            let unit = 0;
            while (size >= 1024 && unit < units.length - 1) {
                size /= 1024;
                unit++;
            }
            return `${number(Math.round(size * 10) / 10)} ${units[unit]}`;
        };
        return { lang, setLang, t, number, date, bytes };
    }, [lang]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    return useContext(I18nContext);
}
