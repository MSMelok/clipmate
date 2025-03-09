import { auth } from './firebase.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';

// DOM Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginTab = document.querySelector('[data-tab="login"]');
const signupTab = document.querySelector('[data-tab="signup"]');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupConfirmPassword = document.getElementById('signup-confirm-password');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const darkIcon = document.getElementById('dark-icon');
const lightIcon = document.getElementById('light-icon');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const loadingOverlay = document.getElementById('loading-overlay');

// Initialize the app
function init() {
    setupEventListeners();
    checkTheme();
    checkAuthState();
}

// Set up event listeners
function setupEventListeners() {
    // Tab switching
    loginTab.addEventListener('click', () => switchTab('login'));
    signupTab.addEventListener('click', () => switchTab('signup'));
    
    // Form submissions
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    
    // Theme toggle
    themeToggleBtn.addEventListener('click', toggleTheme);
}

// Check and apply the saved theme
function checkTheme() {
    const savedTheme = localStorage.getItem('clipmate-theme') || 'dark';
    document.body.classList.toggle('light-theme', savedTheme === 'light');
    updateThemeIcons(savedTheme === 'light');
}

// Toggle between light and dark themes
function toggleTheme() {
    const isLightTheme = document.body.classList.toggle('light-theme');
    updateThemeIcons(isLightTheme);
    localStorage.setItem('clipmate-theme', isLightTheme ? 'light' : 'dark');
}

// Update theme icons visibility
function updateThemeIcons(isLightTheme) {
    darkIcon.style.display = isLightTheme ? 'block' : 'none';
    lightIcon.style.display = isLightTheme ? 'none' : 'block';
}

// Check current authentication state
function checkAuthState() {
    showLoading();
    
    onAuthStateChanged(auth, (user) => {
        hideLoading();
        
        if (user) {
            // User is signed in, redirect to clipboard page
            window.location.href = '/clipboard';
        }
    });
}

// Switch between login and signup tabs
function switchTab(tab) {
    // Clear error messages
    loginError.textContent = '';
    signupError.textContent = '';
    
    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.style.display = 'flex';
        signupForm.style.display = 'none';
    } else {
        loginTab.classList.remove('active');
        signupTab.classList.add('active');
        loginForm.style.display = 'none';
        signupForm.style.display = 'flex';
    }
}

// Handle login form submission
function handleLogin(event) {
    event.preventDefault();
    
    const email = loginEmail.value;
    const password = loginPassword.value;
    
    // Simple validation
    if (!email || !password) {
        loginError.textContent = 'Please enter both email and password';
        return;
    }
    
    // Show loading
    showLoading();
    
    // Attempt to sign in
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Login successful, redirect handled by auth state listener
        })
        .catch((error) => {
            hideLoading();
            
            // Handle different error codes
            switch(error.code) {
                case 'auth/invalid-email':
                    loginError.textContent = 'Invalid email format';
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    loginError.textContent = 'Invalid email or password';
                    break;
                case 'auth/too-many-requests':
                    loginError.textContent = 'Too many login attempts. Try again later';
                    break;
                default:
                    loginError.textContent = 'Login failed: ' + error.message;
            }
        });
}

// Handle signup form submission
function handleSignup(event) {
    event.preventDefault();
    
    const email = signupEmail.value;
    const password = signupPassword.value;
    const confirmPassword = signupConfirmPassword.value;
    
    // Clear previous error
    signupError.textContent = '';
    
    // Simple validation
    if (!email || !password || !confirmPassword) {
        signupError.textContent = 'Please fill out all fields';
        return;
    }
    
    if (password !== confirmPassword) {
        signupError.textContent = 'Passwords do not match';
        return;
    }
    
    if (password.length < 6) {
        signupError.textContent = 'Password must be at least 6 characters';
        return;
    }
    
    // Show loading
    showLoading();
    
    try {
        // Attempt to create user
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signup successful, redirect handled by auth state listener
                showToast('Account created successfully!');
            })
            .catch((error) => {
                hideLoading();
                console.error("Signup error:", error);
                
                // Handle different error codes
                switch(error.code) {
                    case 'auth/email-already-in-use':
                        signupError.textContent = 'Email already in use';
                        break;
                    case 'auth/invalid-email':
                        signupError.textContent = 'Invalid email format';
                        break;
                    case 'auth/weak-password':
                        signupError.textContent = 'Password is too weak';
                        break;
                    default:
                        signupError.textContent = 'Signup failed: ' + error.message;
                }
            });
    } catch (error) {
        hideLoading();
        console.error("Signup exception:", error);
        signupError.textContent = 'Error creating account. Please try again.';
    }
}

// Show toast notification
function showToast(message, duration = 3000) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Show loading overlay
function showLoading() {
    loadingOverlay.classList.add('show');
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);