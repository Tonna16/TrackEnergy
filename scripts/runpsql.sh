#!/bin/bash
# Copyright (c) 2012-2025, EnterpriseDB Corporation.  All rights reserved

# PostgreSQL psql runner script for OS X

# Check the command line
if [ $# -ne 0 -a $# -ne 1 ]; 
then
    echo "Usage: $0 [wait]"
    exit 127
fi

echo -n "Server [localhost]: "
read SERVER

if [ "$SERVER" = "" ];
then
    SERVER="localhost"
fi

echo -n "Database [postgres]: "
read DATABASE

if [ "$DATABASE" = "" ];
then
    DATABASE="postgres"
fi

echo -n "Port [5432]: "
read PORT

if [ "$PORT" = "" ];
then
    PORT="5432"
fi

echo -n "Username [postgres]: "
read USERNAME

if [ "$USERNAME" = "" ];
then
    USERNAME="postgres"
fi

"/Users/adannaa/Downloads/EnergyTracker/bin/psql" -h $SERVER -p $PORT -U $USERNAME $DATABASE
RET=$?

if [ "$RET" != "0" ];
then
    echo
    echo -n "Press <return> to continue..."
    read dummy
fi

exit $RET
