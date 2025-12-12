import { ShieldCheck } from "lucide-react";

export function SecurityBadge() {
    return (
        <div className="flex items-center space-x-2 bg-green-500/10 text-green-600 px-3 py-1 rounded-full text-sm font-medium border border-green-500/20">
            <ShieldCheck className="h-4 w-4" />
            <span>End-to-End Encrypted</span>
        </div>
    );
}
