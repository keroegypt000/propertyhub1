#!/bin/bash
# Post-deployment script for Vercel
# Runs Prisma migrations after deployment
npx prisma migrate deploy
