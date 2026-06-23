import { Brand } from "@/constants/theme";

export const getRandomColor = (name: string) => {
    const colors = [
        "#E5484D", // Red
        Brand.primary,
        Brand.success,
        "#F58300", // Orange
        "#9D44C0", // Purple
        "#00B5AD", // Teal
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};
