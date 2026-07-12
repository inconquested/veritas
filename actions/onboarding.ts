"use server"

import {auth, clerkClient} from "@clerk/nextjs/server";

export async function updateUserRole(role: "client" | "freelancer") {
    const {userId} = await auth()
    if (!userId) {
        throw new Error("User not authenticated");
    }
    const client = await clerkClient()

    await client.users.updateUserMetadata(userId,{
        publicMetadata:{
            role
        }
    })
    return {success: true}
}