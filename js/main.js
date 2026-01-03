// ===== Surabhi - Main JavaScript =====

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initMobileMenu();
    initScrollToTop();
    initCookieBanner();
    initSmoothScroll();
    initHeaderScroll();
    scrollToTopOnLoad();
});

// ===== Scroll to Top on Page Load =====
function scrollToTopOnLoad() {
    window.scrollTo(0, 0);
}

// ===== Mobile Menu =====
function initMobileMenu() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', function() {
            mobileMenu.classList.toggle('active');
            
            // Toggle hamburger animation
            const spans = menuToggle.querySelectorAll('span');
            spans.forEach((span, index) => {
                span.style.transform = mobileMenu.classList.contains('active') 
                    ? (index === 0 ? 'rotate(45deg) translate(5px, 5px)' : index === 1 ? 'opacity: 0' : 'rotate(-45deg) translate(7px, -6px)')
                    : '';
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!menuToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.remove('active');
            }
        });
        
        // Close menu when clicking a link
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('active');
            });
        });
    }
}

// ===== Scroll to Top Button =====
function initScrollToTop() {
    const scrollBtn = document.querySelector('.scroll-to-top');
    
    if (scrollBtn) {
        // Show/hide button based on scroll position
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        });
        
        // Scroll to top when clicked
        scrollBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// ===== Cookie Banner =====
function initCookieBanner() {
    const cookieBanner = document.querySelector('.cookie-banner');
    const acceptBtn = document.querySelector('.cookie-accept');
    const declineBtn = document.querySelector('.cookie-decline');
    
    // Check if user has already made a choice
    const cookieChoice = localStorage.getItem('cookieConsent');
    
    if (!cookieChoice && cookieBanner) {
        // Show banner after a short delay
        setTimeout(() => {
            cookieBanner.classList.add('active');
        }, 1000);
    }
    
    if (acceptBtn) {
        acceptBtn.addEventListener('click', function() {
            localStorage.setItem('cookieConsent', 'accepted');
            cookieBanner.classList.remove('active');
        });
    }
    
    if (declineBtn) {
        declineBtn.addEventListener('click', function() {
            localStorage.setItem('cookieConsent', 'declined');
            cookieBanner.classList.remove('active');
        });
    }
}

// ===== Smooth Scroll for Anchor Links =====
function initSmoothScroll() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                
                if (target) {
                    const headerHeight = document.querySelector('.header').offsetHeight;
                    const targetPosition = target.offsetTop - headerHeight - 20;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

// ===== Header Scroll Effect =====
function initHeaderScroll() {
    const header = document.querySelector('.header');
    let lastScroll = 0;
    
    if (header) {
        window.addEventListener('scroll', function() {
            const currentScroll = window.pageYOffset;
            
            // Add shadow when scrolled
            if (currentScroll > 10) {
                header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
            } else {
                header.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            }
            
            lastScroll = currentScroll;
        });
    }
}

// ===== Form Validation Helper =====
function validateForm(formElement) {
    const inputs = formElement.querySelectorAll('input[required], textarea[required], select[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
        
        // Email validation
        if (input.type === 'email' && input.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value)) {
                isValid = false;
                input.classList.add('error');
            }
        }
    });
    
    return isValid;
}

// ===== Utility Functions =====

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Format date
function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-IN', options);
}

// Format time
function formatTime(date) {
    const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(date).toLocaleTimeString('en-IN', options);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// ===== Intersection Observer for Animations =====
function initAnimations() {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animated');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });
        
        animatedElements.forEach(el => observer.observe(el));
    } else {
        // Fallback for older browsers
        animatedElements.forEach(el => el.classList.add('animated'));
    }
}

// Initialize animations when DOM is ready
document.addEventListener('DOMContentLoaded', initAnimations);
