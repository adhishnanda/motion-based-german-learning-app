import React from 'react'

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  children: React.ReactNode
}

const Heading: React.FC<HeadingProps> = ({
  level = 1,
  children,
  className = '',
  ...props
}) => {
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
  const levelClass = `heading-${level}`
  
  return (
    <HeadingTag
      className={`${levelClass} ${className}`}
      {...props}
    >
      {children}
    </HeadingTag>
  )
}

export default Heading

