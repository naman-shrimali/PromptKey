"use client";
import QRCode from "react-qr-code";

export function QRGenerator({ url }: { url: string }) {
    return (
        <QRCode
            value={url}
            size={256}
            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            viewBox={`0 0 256 256`}
        />
    );
}
