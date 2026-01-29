import Link from "next/link";
import Image from "next/image";
import Logo from "./Logo";

export default function Header() {
    return (
        <nav className=" flex w-full justify-center py-4 items-center 
        border-b border-gray-300  backdrop-blur-2xl font-mono text-sm px-4 lg:px-0">
            <div className="max-w-3xl flex w-full items-center justify-between">
                <div className="font-medium text-xl text-indigo-900 flex items-center gap-2">
                    <Logo className="w-4 h-4" />
                    <Link href='/'>
                        Suno API
                    </Link>
                </div>
                <div className="flex items-center justify-center gap-1 text-sm font-light text-indigo-900/90">
                    <p className="p-2 lg:px-6 lg:py-3 rounded-full flex justify-center items-center
                lg:hover:bg-indigo-300 duration-200
                ">
                        <Link href="/">
                            Get Started
                        </Link>
                    </p>
                    <p className="p-2 lg:px-6 lg:py-3 rounded-full flex justify-center items-center
                lg:hover:bg-indigo-300 duration-200
                ">
                        <Link href="/docs">
                            API Docs
                        </Link>
                    </p>
                    <p className="p-2 lg:px-6 lg:py-3 rounded-full flex justify-center items-center
                lg:hover:bg-indigo-300 duration-200
                ">
                        <a href="https://github.com/gcui-art/suno-api/"
                            target="_blank"
                            className="flex items-center justify-center gap-1">
                            <span className="">
                                <Image src="/github-mark.png" alt="GitHub Logo" width={20} height={20} />
                            </span>
                            <span>Github</span>
                        </a>
                    </p>
                    <p className="p-2 lg:px-6 lg:py-3 rounded-full flex justify-center items-center
                lg:hover:bg-indigo-300 duration-200
                ">
                        <Link href="/admin/pool" className="flex items-center justify-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="hidden lg:inline">管理</span>
                        </Link>
                    </p>
                </div>



            </div>
        </nav>
    );
}
