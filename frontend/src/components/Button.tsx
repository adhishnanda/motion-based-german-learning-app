import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  children: React.ReactNode
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  style,
  ...props
}) => {
  const variantClass = variant === 'danger' ? 'btn-danger' : `btn-${variant}`
  
  return (
    <button
      className={`btn ${variantClass} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button

