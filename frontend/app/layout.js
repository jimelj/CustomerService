import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: '📞 CS',
  description: 'Customer Service Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 text-gray-900`}>
        <div className="min-h-screen flex flex-col">
          <header className="bg-blue-700 text-white py-4 shadow-md">
            <div className="max-w-7xl mx-auto flex items-center gap-2 px-4">
              {/* <span className="text-2xl">📞</span> */}
              {/* <span className="text-2xl font-bold tracking-tight">CS</span> */}
              <span className="ml-2 text-base font-medium text-blue-100">Customer Service Dashboard</span>
            </div>
          </header>
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
