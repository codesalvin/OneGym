from django.urls import path

from .views import (
    book_class,
    cancel_booking,
    class_list,
    health_check,
    request_password_reset,
    reset_password,
    sign_in,
    sign_up,
    social_auth,
    user_bookings,
    user_list,
)

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('users/', user_list, name='user-list'),
    path('users/<int:user_id>/bookings/', user_bookings, name='user-bookings'),
    path('classes/', class_list, name='class-list'),
    path('classes/<int:class_id>/book/', book_class, name='book-class'),
    path('bookings/<int:booking_id>/cancel/', cancel_booking, name='cancel-booking'),
    path('auth/signup/', sign_up, name='sign-up'),
    path('auth/signin/', sign_in, name='sign-in'),
    path('auth/social/', social_auth, name='social-auth'),
    path('auth/request-password-reset/', request_password_reset, name='request-password-reset'),
    path('auth/reset-password/', reset_password, name='reset-password'),
]
